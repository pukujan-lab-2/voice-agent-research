// Prints how big the model's prompt gets while a whole form is filled, for forms of 10, 100 and 300 fields.
// Usage: node tests/scale-report.ts   (numbers are characters of JSON per request; about 4 characters make a token)
import { bigFlow, fillAll } from './scale-flow.ts';

console.log('| fields | turns | first prompt | largest prompt | about tokens |');
console.log('|---|---|---|---|---|');
for (const n of [10, 100, 300]) {
  const { desk, model } = await fillAll(bigFlow(n));
  const worst = Math.max(...model.sizes);
  console.log(`| ${n} | ${model.sizes.length} | ${model.sizes[0]} | ${worst} | ${Math.round(worst / 4)} |${desk.allFilled() ? '' : ' (not finished)'}`);
}
