import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

const ISSUER = 'DNPEC SI';

/** Génération/validation TOTP (2FA obligatoire pour DN, DNA, CHEF_DIVISION, CHEF_CELLULE — §3.3). */
@Injectable()
export class TotpService {
  generateSecret(): string {
    return authenticator.generateSecret();
  }

  buildOtpAuthUrl(secret: string, email: string): string {
    return authenticator.keyuri(email, ISSUER, secret);
  }

  generateQrCodeDataUrl(otpAuthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpAuthUrl);
  }

  verify(code: string, secret: string): boolean {
    try {
      return authenticator.verify({ token: code, secret });
    } catch {
      return false;
    }
  }
}
