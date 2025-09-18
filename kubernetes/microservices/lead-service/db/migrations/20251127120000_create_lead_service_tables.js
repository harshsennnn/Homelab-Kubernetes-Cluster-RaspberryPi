exports.up = function (knex) {
  return knex.schema
    .createTable('users', function (table) {
      table.uuid('id').primary();
      table.string('name').notNullable();
      table.string('email').notNullable().unique();
      table.string('role').notNullable();
      table.timestamps(true, true);
    })
    .createTable('categories', function (table) {
      table.uuid('id').primary();
      table.string('name').notNullable().unique();
      table.timestamps(true, true);
    })
    .createTable('products', function (table) {
      table.uuid('id').primary();
      table.string('name').notNullable();
      table.text('description');
      table.uuid('category_id').references('id').inTable('categories').onDelete('SET NULL');
      table.uuid('brand');
      table.uuid('seller_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('status').defaultTo('draft');
      table.integer('stock_quantity').defaultTo(0);
      table.boolean('is_lead_placeholder').defaultTo(false);
      table.timestamps(true, true);
    })
    .createTable('requirements', function (table) {
      table.uuid('id').primary();
      table.uuid('buyer_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('product_name');
      table.text('details');
      table.string('quantity');
      table.string('location_preference');
      table.string('city');
      table.string('status').defaultTo('Open');
      table.timestamps(true, true);
    })
    .createTable('conversations', function (table) {
      table.uuid('id').primary();
      table.uuid('product_id').references('id').inTable('products').onDelete('SET NULL');
      table.timestamps(true, true);
    })
    .createTable('conversations', function (table) {
      table.uuid('id').primary();
      table.uuid('requirement_id').notNullable();
      table.uuid('product_id').nullable();
      table.timestamps(true, true);

      table.unique(['requirement_id']);
    })

    .createTable('requirement_contacted_sellers', function (table) {
      table.uuid('requirement_id').references('id').inTable('requirements').onDelete('CASCADE');
      table.uuid('seller_id').references('id').inTable('users').onDelete('CASCADE');
      table.primary(['requirement_id', 'seller_id']);
      table.timestamps(true, true);
    })
    .createTable('conversation_participants', function (table) {
      table.uuid('conversation_id').references('id').inTable('conversations').onDelete('CASCADE');
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.primary(['conversation_id', 'user_id']);
      table.timestamps(true, true);
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('conversation_participants')
    .dropTableIfExists('requirement_contacted_sellers')
    .dropTableIfExists('messages')
    .dropTableIfExists('conversations')
    .dropTableIfExists('requirements')
    .dropTableIfExists('products')
    .dropTableIfExists('categories')
    .dropTableIfExists('users');
};
