CREATE TABLE `saved_trades` (
  `id` integer not null primary key autoincrement,
  `portfolio_id` integer,
  `symbol` varchar(255) not null,
  `option_symbol` varchar(255) not null,
  `type` varchar(255) not null,
  `side` varchar(255) not null,
  `quantity` integer not null,
  `strike_price` float not null,
  `expiration_date` bigint not null,
  `note` varchar(255) null,
  `created_at` datetime default CURRENT_TIMESTAMP,
  foreign key(`portfolio_id`) references `portfolios`(`id`) on delete CASCADE
)