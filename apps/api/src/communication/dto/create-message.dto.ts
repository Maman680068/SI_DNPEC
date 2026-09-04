import { IsOptional, IsString, Length } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  recipientId!: string;

  @IsString()
  @Length(1, 4000)
  body!: string;

  @IsOptional()
  @IsString()
  attachmentKey?: string;

  @IsOptional()
  @IsString()
  attachmentName?: string;
}
