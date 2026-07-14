import { filterHandler } from './filter';
import { mapHandler } from './map';
import { registerHandler } from './registry';
import { takeHandler } from './take';

registerHandler(mapHandler);
registerHandler(filterHandler);
registerHandler(takeHandler);

export { getHandler } from './registry';
