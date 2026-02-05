CREATE TABLE `trades` (
  `id` integer not null primary key autoincrement,
  `portfolio_id` integer,
  `symbol` varchar(255) not null,
  `option_symbol` varchar(255) not null,
  `type` varchar(255) not null,
  `side` varchar(255) not null,
  `quantity` integer not null,
  `price` float not null,
  `timestamp` datetime default CURRENT_TIMESTAMP,
  `expiration_date` date null,
  `spread_id` varchar(255) null,
  foreign key(`portfolio_id`) references `portfolios`(`id`) on delete CASCADE
)