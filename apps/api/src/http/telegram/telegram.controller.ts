import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  type CreateTelegramChatInput,
  createTelegramChatSchema,
  type DiscoveredTelegramChatDto,
  type TelegramChatDto,
  type TelegramStatusDto,
  type UpdateTelegramChatInput,
  updateTelegramChatSchema,
} from '@igw/shared';
import { ClockPort, TelegramChatRepository, TelegramPort } from '../../application/ports';
import { escapeHtml } from '../../infrastructure/notifier/telegram-message';
import { presentTelegramChat } from '../common/presenters';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegram: TelegramPort,
    private readonly chats: TelegramChatRepository,
    private readonly clock: ClockPort,
  ) {}

  @Get()
  async status(): Promise<TelegramStatusDto> {
    const chats = (await this.chats.list()).map(presentTelegramChat);
    if (!this.telegram.isConfigured())
      return { configured: false, botUsername: null, botError: null, chats };
    try {
      return {
        configured: true,
        botUsername: await this.telegram.getBotUsername(),
        botError: null,
        chats,
      };
    } catch (error) {
      return { configured: true, botUsername: null, botError: (error as Error).message, chats };
    }
  }

  @Get('discover')
  async discover(): Promise<DiscoveredTelegramChatDto[]> {
    const [found, existing] = await Promise.all([this.telegram.discoverChats(), this.chats.list()]);
    const added = new Set(existing.map((c) => c.chatId));
    return found.map((c) => ({ ...c, alreadyAdded: added.has(c.chatId) }));
  }

  @Post('chats')
  async create(
    @Body(new ZodValidationPipe(createTelegramChatSchema)) body: CreateTelegramChatInput,
  ): Promise<TelegramChatDto> {
    return presentTelegramChat(await this.chats.create(body.chatId, body.label));
  }

  @Patch('chats/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateTelegramChatSchema)) body: UpdateTelegramChatInput,
  ): Promise<TelegramChatDto> {
    const chat = await this.chats.setActive(id, body.active);
    if (!chat) throw new NotFoundException('Chat bulunamadı');
    return presentTelegramChat(chat);
  }

  @Delete('chats/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    if (!(await this.chats.delete(id))) throw new NotFoundException('Chat bulunamadı');
  }

  @Post('chats/:id/test')
  @HttpCode(HttpStatus.OK)
  async test(@Param('id', ParseUUIDPipe) id: string): Promise<{ ok: boolean; message: string }> {
    const chat = await this.chats.findById(id);
    if (!chat) throw new NotFoundException('Chat bulunamadı');
    const now = this.clock.now();
    try {
      await this.telegram.sendMessage(
        chat.chatId,
        `✅ <b>IG Keyword Watch</b> test mesajı${chat.label ? ` — ${escapeHtml(chat.label)}` : ''}\nBildirimler bu sohbete gelecek.`,
      );
      await this.chats.recordResult(chat.id, null, now);
      return { ok: true, message: 'Test mesajı gönderildi' };
    } catch (error) {
      const message = (error as Error).message;
      await this.chats.recordResult(chat.id, message, now);
      return { ok: false, message: `Gönderilemedi: ${message}` };
    }
  }
}
