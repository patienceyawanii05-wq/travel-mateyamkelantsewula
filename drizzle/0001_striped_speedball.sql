CREATE TABLE `savedItineraries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`conversationId` int,
	`destination` varchar(160) NOT NULL,
	`summary` varchar(255) NOT NULL,
	`itineraryBody` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `savedItineraries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `travelConversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(120) NOT NULL,
	`destination` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `travelConversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `travelMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `travelMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `savedItineraries` ADD CONSTRAINT `savedItineraries_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `savedItineraries` ADD CONSTRAINT `savedItineraries_conversationId_travelConversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `travelConversations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `travelConversations` ADD CONSTRAINT `travelConversations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `travelMessages` ADD CONSTRAINT `travelMessages_conversationId_travelConversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `travelConversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `savedItineraries_userId_createdAt_idx` ON `savedItineraries` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `travelConversations_userId_updatedAt_idx` ON `travelConversations` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `travelMessages_conversationId_createdAt_idx` ON `travelMessages` (`conversationId`,`createdAt`);