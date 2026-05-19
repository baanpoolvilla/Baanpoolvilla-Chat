import type { Message, MessageReplyPreview } from '@/types';

type ReplySource = Pick<Message, 'content' | 'contentType' | 'senderType' | 'admin'> | Pick<MessageReplyPreview, 'content' | 'contentType' | 'senderType' | 'admin'>;

export function getReplySenderLabel(message: ReplySource, customerName?: string): string {
  if (message.senderType === 'CUSTOMER') return customerName || 'Customer';
  if (message.senderType === 'BOT') return 'AI Bot';
  if (message.senderType === 'SYSTEM') return 'System';
  return message.admin?.name || 'Admin';
}

export function getReplyPreviewText(message: ReplySource): string {
  switch (message.contentType) {
    case 'IMAGE':
      return message.content && message.content !== '[Image]' ? message.content : 'Photo';
    case 'VIDEO':
      return message.content && message.content !== '[Video]' ? message.content : 'Video';
    case 'AUDIO':
      return message.content || 'Audio';
    case 'FILE':
      return message.content || 'File';
    case 'STICKER':
      return 'Sticker';
    case 'LOCATION':
      return 'Location';
    case 'TEMPLATE':
      return message.content || 'Template';
    default:
      return message.content;
  }
}