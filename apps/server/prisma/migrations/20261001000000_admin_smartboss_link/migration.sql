-- SmartBoss single sign-on: which SmartBoss user an admin account belongs to
ALTER TABLE "Admin" ADD COLUMN "smartbossUserId" TEXT;
CREATE UNIQUE INDEX "Admin_smartbossUserId_key" ON "Admin"("smartbossUserId");
