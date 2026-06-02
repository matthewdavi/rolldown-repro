import { ExpectedToBeIncluded } from './expected-to-be-included';
import { EliminatedImport } from './eliminated-import';
import { ComponentOnlyRenderedInHere } from './component-only-rendered-in-here';

const component = __RESTRICTED__ ? (
  <EliminatedImport owner="root1">
    <ComponentOnlyRenderedInHere owner="root1" />
  </EliminatedImport>
) : null;

console.log('root1', <ExpectedToBeIncluded owner="root1" />, component);
