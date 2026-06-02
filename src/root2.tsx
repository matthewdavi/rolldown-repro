import { expectedToBeIncluded } from './expected-to-be-included';
import { internalFeature } from './internal-module';

const gatedValue = __IS_GATED_BUILD__
  ? internalFeature('root2')
  : null;

console.log('root2', expectedToBeIncluded('root2'), gatedValue);
