CREATE TABLE `competitions` (
  `id` integer not null primary key autoincrement,
  `name` varchar(255) not null,
  `start_date` datetime not null,
  `end_date` datetime not null,
  `initial_balance` float not null,
  `status` varchar(255) default 'active',
  `created_by` integer,
  `created_at` datetime default CURRENT_TIMESTAMP,
  foreign key(`created_by`) references `users`(`id`) on delete CASCADE
)