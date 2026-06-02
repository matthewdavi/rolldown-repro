import { expectedToBeIncluded } from './expected-to-be-included';
import { internalFeature } from './internal-module';

const gatedValue = __IS_GATED_BUILD__
  ? internalFeature('root1')
  : null;

console.log('root1', expectedToBeIncluded('root1'), gatedValue);
