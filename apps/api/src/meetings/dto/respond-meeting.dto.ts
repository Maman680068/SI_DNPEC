import { IsIn } from 'class-validator';
import { MeetingResponseStatus } from '@prisma/client';

/** EN_ATTENTE est délibérément exclu : "répondre" à une invitation ne peut
 * signifier qu'accepter ou décliner, jamais revenir à l'état initial. */
export class RespondMeetingDto {
  @IsIn([MeetingResponseStatus.CONFIRME, MeetingResponseStatus.DECLINE])
  status!: MeetingResponseStatus;
}
