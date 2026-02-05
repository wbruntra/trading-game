CREATE TABLE `portfolio_history` (
  `id` integer not null primary key autoincrement,
  `portfolio_id` integer not null,
  `total_value` float not null,
  `cash_balance` float not null,
  `timestamp` datetime default CURRENT_TIMESTAMP,
  foreign key(`portfolio_id`) references `portfolios`(`id`) on delete CASCADE
)