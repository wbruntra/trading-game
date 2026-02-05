CREATE TABLE `users` (
  `id` integer not null primary key autoincrement,
  `username` varchar(255) not null,
  `password_hash` varchar(255) not null,
  `created_at` datetime default CURRENT_TIMESTAMP
)