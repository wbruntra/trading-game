CREATE TABLE `portfolios` (
  `id` integer not null primary key autoincrement,
  `user_id` integer,
  `competition_id` integer,
  `cash_balance` float not null,
  `created_at` datetime default CURRENT_TIMESTAMP,
  `total_value` float default '0',
  `last_updated_at` datetime null,
  foreign key(`user_id`) references `users`(`id`) on delete CASCADE,
  foreign key(`competition_id`) references `competitions`(`id`) on delete CASCADE
)