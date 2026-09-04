import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from '../dto/create-message.dto';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  send(@Body() dto: CreateMessageDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.messagesService.send(actor, dto);
  }

  @Get('conversations')
  listConversations(@CurrentUser() actor: AuthenticatedUser) {
    return this.messagesService.listConversations(actor);
  }

  @Get('with/:userId')
  listWith(@Param('userId') userId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.messagesService.listWith(actor, userId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.messagesService.markRead(actor, id);
  }
}
