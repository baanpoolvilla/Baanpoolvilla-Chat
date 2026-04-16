// ─── Enums ──────────────────────────────────────────────
export type Platform = 'LINE' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'MANUAL';
export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'AGENT';
export type ConversationStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'SNOOZED';
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type SenderType = 'CUSTOMER' | 'ADMIN' | 'BOT' | 'SYSTEM';
export type ContentType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'STICKER' | 'LOCATION' | 'TEMPLATE';
export type BroadcastTarget = 'ALL' | 'BY_TAG' | 'BY_PLATFORM' | 'CUSTOM';
export type BroadcastStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'COMPLETED' | 'FAILED';

// ─── Models ─────────────────────────────────────────────
export interface Admin {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: AdminRole;
  isOnline: boolean;
  lastSeenAt?: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  displayName: string;
  avatarUrl?: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  platformLinks?: PlatformContact[];
  tags?: ContactTagJoin[];
  _count?: { conversations: number };
}

export interface PlatformContact {
  id: string;
  contactId: string;
  platform: Platform;
  platformUid: string;
  metadata?: Record<string, unknown>;
}

export interface TagCategory {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  tags?: Tag[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  categoryId?: string;
  createdAt: string;
  category?: TagCategory;
}

export interface ConversationTagJoin {
  conversationId: string;
  tagId: string;
  addedAt: string;
  addedByAdminId?: string;
  tag: Tag;
}

export interface ContactTagJoin {
  contactId: string;
  tagId: string;
  tag: Tag;
}

export interface ConversationAssignment {
  id: string;
  conversationId: string;
  adminId: string;
  assignedAt: string;
  admin: Pick<Admin, 'id' | 'name' | 'avatar'>;
}

export interface Conversation {
  id: string;
  contactId: string;
  platform: Platform;
  channelId: string;
  status: ConversationStatus;
  isBot: boolean;
  priority: Priority;
  lastMessage?: string;
  lastMsgAt?: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  contact: Contact;
  tags?: ConversationTagJoin[];
  assignments?: ConversationAssignment[];
  messages?: Message[];
  notes?: ConversationNote[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderType: SenderType;
  adminId?: string;
  content: string;
  contentType: ContentType;
  mediaUrl?: string;
  metadata?: Record<string, unknown>;
  platformMsgId?: string;
  isRead: boolean;
  sentAt: string;
  admin?: Pick<Admin, 'id' | 'name' | 'avatar'>;
  conversation?: Conversation;
}

export interface Broadcast {
  id: string;
  name: string;
  content: string;
  contentType: ContentType;
  mediaUrl?: string;
  platforms: Platform[];
  targetType: BroadcastTarget;
  tagFilter?: { tagIds?: string[] };
  status: BroadcastStatus;
  scheduledAt?: string;
  sentAt?: string;
  totalCount: number;
  sentCount: number;
  failCount: number;
  createdBy: string;
  createdAt: string;
  logs?: BroadcastLog[];
}

export interface BroadcastLog {
  id: string;
  broadcastId: string;
  contactId: string;
  platform: Platform;
  status: string;
  error?: string;
  sentAt: string;
}

export interface ConversationNote {
  id: string;
  conversationId: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

// ─── API Response Types ─────────────────────────────────
export interface ConversationFilters {
  status?: ConversationStatus;
  platform?: Platform;
  search?: string;
  tagIds?: string[];
  adminId?: string;
  isBot?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  [key: string]: unknown;
}

export interface ConversationListResponse extends PaginatedResponse<Conversation> {
  conversations: Conversation[];
}

export interface MessageListResponse extends PaginatedResponse<Message> {
  messages: Message[];
}

export interface ContactListResponse extends PaginatedResponse<Contact> {
  contacts: Contact[];
}

export interface BroadcastListResponse extends PaginatedResponse<Broadcast> {
  broadcasts: Broadcast[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  admin: Admin;
}

// ─── Socket Event Types ─────────────────────────────────
export interface ServerToClientEvents {
  'conversation:new': (conversation: Conversation) => void;
  'conversation:updated': (conversation: Partial<Conversation> & { id: string }) => void;
  'message:new': (message: Message) => void;
  'admin:presence': (presenceMap: Record<string, boolean>) => void;
  'admin:notify': (data: { conversationId: string; contactName: string; message: string; platform: Platform }) => void;
  'admin:typing': (data: { conversationId: string; adminId: string }) => void;
  'bot:typing': (data: { conversationId: string }) => void;
  'error': (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  'conversation:join': (conversationId: string) => void;
  'conversation:leave': (conversationId: string) => void;
  'message:send': (data: { conversationId: string; content: string; contentType?: ContentType; mediaUrl?: string }) => void;
  'conversation:read': (conversationId: string) => void;
  'conversation:assign': (data: { conversationId: string; adminId: string }) => void;
  'conversation:typing': (conversationId: string) => void;
}
