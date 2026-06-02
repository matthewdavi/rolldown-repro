import { ExpectedToBeIncluded } from './expected-to-be-included';
import { EliminatedImport } from './eliminated-import';
import { ComponentOnlyRenderedInHere } from './component-only-rendered-in-here';

const component = __RESTRICTED__ ? (
  <EliminatedImport owner="root2">
    <ComponentOnlyRenderedInHere owner="root2" />
  </EliminatedImport>
) : null;

console.log('root2', <ExpectedToBeIncluded owner="root2" />, component);
