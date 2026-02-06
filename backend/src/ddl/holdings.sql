CREATE TABLE `holdings` (
  `id` integer not null primary key autoincrement,
  `portfolio_id` integer not null,
  `symbol` varchar(255) not null,
  `option_symbol` varchar(255) not null,
  `side` varchar(255) not null,
  `quantity` integer not null,
  `cost_basis` float not null,
  `spread_id` varchar(255) null,
  `created_at` datetime default CURRENT_TIMESTAMP,
  `updated_at` datetime default CURRENT_TIMESTAMP,
  foreign key(`portfolio_id`) references `portfolios`(`id`) on delete CASCADE
)