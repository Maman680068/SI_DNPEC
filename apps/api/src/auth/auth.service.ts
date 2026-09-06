import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuditAction, SystemRole, User, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { PasswordService } from '../common/security/password.service';
import { EmailService } from '../communication/notifications/email.service';
import {
  AccessTokenPayload,
  TwoFaLoginChallengePayload,
  TwoFaSetupRequiredPayload,
} from '../common/types/jwt-payload.type';
import { TotpService } from './services/totp.service';
import { SessionService } from './services/session.service';
import { LoginAttemptService } from './services/login-attempt.service';
import { PasswordResetService } from './services/password-reset.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LoginTwoFaDto } from './dto/login-2fa.dto';
import { EnableTwoFaDto } from './dto/enable-2fa.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

/** Rôles pour lesquels la 2FA est obligatoire (§3.3 du cahier des charges). */
const MANDATORY_2FA_ROLES: SystemRole[] = [
  SystemRole.DN,
  SystemRole.DNA,
  SystemRole.CHEF_DIVISION,
  SystemRole.CHEF_CELLULE,
];

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly totpService: TotpService,
    private readonly sessionService: SessionService,
    private readonly loginAttempts: LoginAttemptService,
    private readonly audit: AuditService,
    private readonly passwordReset: PasswordResetService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  /** Auto-inscription (RF-SEC-01, modalité 2) — soumise à validation admin, cf. UsersService.approveRegistration. */
  async register(dto: RegisterDto, ip: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Un compte existe déjà avec cet email');

    const passwordHash = await this.passwordService.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: SystemRole.AGENT, // valeur d'attente, fixée réellement par l'admin à l'approbation
        status: UserStatus.EN_ATTENTE,
      },
    });

    await this.audit.log({
      actorId: null,
      action: AuditAction.CREATION,
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email, selfRegistered: true, ip },
    });

    return { message: 'Compte créé, en attente de validation par l’administrateur.' };
  }

  /**
   * Mot de passe oublié — répond TOUJOURS le même message, que l'email
   * corresponde ou non à un compte (anti-énumération). L'email n'est envoyé
   * (et le jeton créé) que si un compte ACTIF existe réellement.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.status === UserStatus.ACTIF) {
      const token = await this.passwordReset.createResetToken(user.id);
      const webAppUrl = this.config.get<string>('WEB_APP_URL', 'http://localhost:3100');
      const resetUrl = `${webAppUrl}/reset-password?token=${token}`;
      await this.emailService.send(
        user.email,
        'Réinitialisation de votre mot de passe — DNPEC SI',
        `Bonjour ${user.firstName},\n\n` +
          `Une demande de réinitialisation de mot de passe a été effectuée pour votre compte DNPEC SI.\n` +
          `Cliquez sur le lien suivant pour choisir un nouveau mot de passe (valable 1 heure) :\n\n${resetUrl}\n\n` +
          `Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe reste inchangé.`,
      );
    }
    return { message: 'Si un compte existe avec cette adresse, un email de réinitialisation a été envoyé.' };
  }

  /** Consomme le jeton (usage unique, cf. PasswordResetService), change le mot de
   * passe, puis révoque toutes les sessions actives — un reset invalide tout accès
   * obtenu avant que l'utilisateur (ou un tiers) n'ait changé le mot de passe. */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const userId = await this.passwordReset.consumeToken(dto.token);
    const passwordHash = await this.passwordService.hash(dto.newPassword);

    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.sessionService.revokeAllSessions(userId);

    await this.audit.log({
      actorId: userId,
      action: AuditAction.MODIFICATION,
      entityType: 'User',
      entityId: userId,
      metadata: { event: 'password_reset' },
    });

    return { message: 'Mot de passe réinitialisé avec succès.' };
  }

  async login(dto: LoginDto, ip: string) {
    this.loginAttempts.assertNotLocked(dto.email, ip);

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const passwordValid = user ? await this.passwordService.verify(user.passwordHash, dto.password) : false;

    if (!user || !passwordValid) {
      this.loginAttempts.recordFailure(dto.email, ip);
      await this.audit.log({
        actorId: user?.id ?? null,
        action: AuditAction.CONNEXION,
        entityType: 'User',
        entityId: user?.id ?? dto.email,
        metadata: { result: 'failure', ip },
      });
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (user.status !== UserStatus.ACTIF) {
      throw new ForbiddenException("Ce compte n'est pas actif.");
    }

    this.loginAttempts.recordSuccess(dto.email, ip);

    if (!user.twoFactorEnabled && MANDATORY_2FA_ROLES.includes(user.role)) {
      const setupToken = await this.jwtService.signAsync(
        { sub: user.id, purpose: 'two_fa_setup_required' } satisfies TwoFaSetupRequiredPayload,
        { expiresIn: '10m' },
      );
      return { status: 'two_fa_setup_required' as const, setupToken };
    }

    if (user.twoFactorEnabled) {
      const challengeToken = await this.jwtService.signAsync(
        { sub: user.id, purpose: 'two_fa_login_challenge' } satisfies TwoFaLoginChallengePayload,
        { expiresIn: '5m' },
      );
      return { status: 'two_fa_challenge_required' as const, challengeToken };
    }

    return this.issueSession(user, ip);
  }

  async loginTwoFa(dto: LoginTwoFaDto, ip: string) {
    const payload = await this.verifyPurposeToken<TwoFaLoginChallengePayload>(
      dto.challengeToken,
      'two_fa_login_challenge',
    );
    const user = await this.getUserOrThrow(payload.sub);

    this.loginAttempts.assertNotLocked(user.email, ip);

    const valid = user.twoFactorSecret ? this.totpService.verify(dto.code, user.twoFactorSecret) : false;
    if (!valid) {
      this.loginAttempts.recordFailure(user.email, ip);
      await this.audit.log({
        actorId: user.id,
        action: AuditAction.CONNEXION,
        entityType: 'User',
        entityId: user.id,
        metadata: { result: 'failure_2fa', ip },
      });
      throw new UnauthorizedException('Code de vérification invalide');
    }

    this.loginAttempts.recordSuccess(user.email, ip);
    return this.issueSession(user, ip);
  }

  /** Génère un secret TOTP + QR code. Utilisable avec un access token normal (opt-in) ou un jeton "2FA requise" (première connexion d'un rôle soumis à 2FA). */
  async setupTwoFa(authorizationHeader: string | undefined) {
    const userId = await this.resolveSetupOrAccessSubject(authorizationHeader);
    const user = await this.getUserOrThrow(userId);

    const secret = this.totpService.generateSecret();
    // Secret stocké dès la génération, mais 2FA reste désactivée
    // (twoFactorEnabled=false) tant que /auth/2fa/enable n'a pas confirmé
    // un premier code valide.
    await this.prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret } });

    const otpAuthUrl = this.totpService.buildOtpAuthUrl(secret, user.email);
    const qrCodeDataUrl = await this.totpService.generateQrCodeDataUrl(otpAuthUrl);
    return { secret, otpAuthUrl, qrCodeDataUrl };
  }

  async enableTwoFa(authorizationHeader: string | undefined, dto: EnableTwoFaDto) {
    const userId = await this.resolveSetupOrAccessSubject(authorizationHeader);
    const user = await this.getUserOrThrow(userId);

    if (!user.twoFactorSecret) {
      throw new ConflictException('Aucune configuration 2FA en attente — appelez /auth/2fa/setup au préalable.');
    }
    if (!this.totpService.verify(dto.code, user.twoFactorSecret)) {
      throw new UnauthorizedException('Code de vérification invalide');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
    await this.audit.log({
      actorId: user.id,
      action: AuditAction.MODIFICATION,
      entityType: 'User',
      entityId: user.id,
      metadata: { event: 'two_fa_enabled' },
    });

    return this.issueSession(user, undefined);
  }

  async disableTwoFa(userId: string): Promise<void> {
    const user = await this.getUserOrThrow(userId);
    if (MANDATORY_2FA_ROLES.includes(user.role)) {
      throw new ForbiddenException('La 2FA est obligatoire pour votre rôle et ne peut pas être désactivée.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    await this.audit.log({
      actorId: user.id,
      action: AuditAction.MODIFICATION,
      entityType: 'User',
      entityId: user.id,
      metadata: { event: 'two_fa_disabled' },
    });
  }

  async refresh(plainRefreshToken: string) {
    const { userId, refreshToken } = await this.sessionService.rotateRefreshToken(plainRefreshToken);
    const accessToken = await this.issueAccessToken(userId);
    return { accessToken, refreshToken };
  }

  private async issueSession(user: User, ip: string | undefined) {
    const accessToken = await this.issueAccessToken(user.id);
    const refreshToken = await this.sessionService.createSession(user.id, ip ? `IP ${ip}` : undefined);

    await this.audit.log({
      actorId: user.id,
      action: AuditAction.CONNEXION,
      entityType: 'User',
      entityId: user.id,
      metadata: { result: 'success' },
    });

    return { accessToken, refreshToken };
  }

  private issueAccessToken(userId: string): Promise<string> {
    return this.jwtService.signAsync({ sub: userId, purpose: 'access' } satisfies AccessTokenPayload);
  }

  /** Accepte un access token normal (opt-in volontaire) OU un jeton "2FA requise" émis au login (première configuration obligatoire). */
  private async resolveSetupOrAccessSubject(authorizationHeader: string | undefined): Promise<string> {
    const token = this.extractBearer(authorizationHeader);
    if (!token) throw new UnauthorizedException('Jeton manquant');

    let payload: AccessTokenPayload | TwoFaSetupRequiredPayload;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }
    if (payload.purpose !== 'access' && payload.purpose !== 'two_fa_setup_required') {
      throw new UnauthorizedException('Jeton invalide pour cette étape');
    }
    return payload.sub;
  }

  private async verifyPurposeToken<T extends { sub: string; purpose: string }>(
    token: string,
    purpose: T['purpose'],
  ): Promise<T> {
    let payload: T;
    try {
      payload = await this.jwtService.verifyAsync<T>(token);
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }
    if (payload.purpose !== purpose) {
      throw new UnauthorizedException('Jeton invalide pour cette étape');
    }
    return payload;
  }

  private extractBearer(header?: string): string | undefined {
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }

  private async getUserOrThrow(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');
    return user;
  }
}
