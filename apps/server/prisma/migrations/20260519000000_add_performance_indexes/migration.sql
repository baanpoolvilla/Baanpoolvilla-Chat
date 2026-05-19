CREATE INDEX "PlatformContact_platform_contactId_idx" ON "PlatformContact"("platform", "contactId");

CREATE INDEX "ConversationTag_tagId_conversationId_idx" ON "ConversationTag"("tagId", "conversationId");

CREATE INDEX "ContactTag_tagId_contactId_idx" ON "ContactTag"("tagId", "contactId");

CREATE INDEX "Conversation_lastMsgAt_idx" ON "Conversation"("lastMsgAt");

CREATE INDEX "Conversation_status_lastMsgAt_idx" ON "Conversation"("status", "lastMsgAt");

CREATE INDEX "Conversation_platform_lastMsgAt_idx" ON "Conversation"("platform", "lastMsgAt");

CREATE INDEX "Conversation_isBot_lastMsgAt_idx" ON "Conversation"("isBot", "lastMsgAt");

CREATE INDEX "Conversation_contact_platform_channel_status_idx" ON "Conversation"("contactId", "platform", "channelId", "status");

CREATE INDEX "ConversationAssignment_adminId_conversationId_idx" ON "ConversationAssignment"("adminId", "conversationId");

CREATE INDEX "Message_conversationId_isRead_idx" ON "Message"("conversationId", "isRead");

CREATE INDEX "Message_platformMsgId_idx" ON "Message"("platformMsgId");

CREATE INDEX "ConversationNote_conversationId_createdAt_idx" ON "ConversationNote"("conversationId", "createdAt");
