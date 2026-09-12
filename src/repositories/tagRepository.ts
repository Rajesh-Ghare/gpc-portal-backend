import type { Transaction } from 'sequelize';
import { Tag } from '../models';
import { slugify } from '../utils/slugify';

/**
 * Tags have no standalone admin API (spec section 24 doesn't list one) —
 * they're managed inline as part of question create/update payloads, so
 * this find-or-create is the only write path.
 */
export async function findOrCreateTagByName(name: string, transaction: Transaction) {
  const slug = slugify(name);
  const [tag] = await Tag.findOrCreate({
    where: { slug },
    defaults: { name, slug },
    transaction,
  });
  return tag;
}
