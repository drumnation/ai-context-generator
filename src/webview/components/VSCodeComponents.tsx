import React, { useState, useEffect, ReactElement } from 'react';

// Define the component types we know are available from the toolkit
type VSCodeComponentName =
  | 'VSCodeButton'
  | 'VSCodeCheckbox'
  | 'VSCodeRadioGroup'
  | 'VSCodeRadio'
  | 'VSCodeTextField'
  | 'VSCodeDropdown'
  | 'VSCodeOption'
  | 'VSCodeTag'
  | 'VSCodeProgressRing'
  | 'VSCodePanels'
  | 'VSCodePanelTab'
  | 'VSCodePanelView'
  | 'VSCodeDivider'
  | 'VSCodeLink'
  | 'VSCodeDataGrid'
  | 'VSCodeDataGridRow'
  | 'VSCodeDataGridCell';

// Define a more specific type for component props
type VSCodeComponentProps = {
  as?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
};

// Define event types
export type VSCodeChangeEvent = React.ChangeEvent<
  HTMLInputElement | HTMLSelectElement
>;

// Shared loading component
const LoadingPlaceholder: React.FC = () => (
  <div
    style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
  >
    Loading component...
  </div>
);

// Factory for creating dynamically loaded VS Code components
function createDynamicComponent(componentName: VSCodeComponentName) {
  return function DynamicComponent(props: VSCodeComponentProps): ReactElement {
    // Using unknown instead of any
    const [Component, setComponent] =
      useState<React.ComponentType<unknown> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
      let mounted = true;

      async function loadComponent() {
        try {
          // Dynamically import the VS Code webview UI toolkit
          const toolkit = await import('@vscode/webview-ui-toolkit/react');

          if (mounted) {
            // Safely get the specific component from the imported module
            if (componentName in toolkit) {
              // Use unknown instead of any for the component type
              const comp = toolkit[
                componentName as keyof typeof toolkit
              ] as unknown as React.ComponentType<unknown>;
              setComponent(() => comp);
              setLoading(false);
            } else {
              throw new Error(
                `Component ${componentName} not found in toolkit`,
              );
            }
          }
        } catch (err) {
          if (mounted) {
            console.error(`Failed to load ${componentName}:`, err);
            setError(err instanceof Error ? err : new Error(String(err)));
            setLoading(false);
          }
        }
      }

      loadComponent();

      return () => {
        mounted = false;
      };
    }, []);

    if (loading) {
      return <LoadingPlaceholder />;
    }

    if (error || !Component) {
      return (
        <div>Error loading component: {error?.message || 'Unknown error'}</div>
      );
    }

    // Remove the 'as' prop before passing to the underlying component
    const { as: _, ...componentProps } = props;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <Component {...(componentProps as any)} />;
  };
}

// Create wrapped components with proper typing
export const VSCodeButton = createDynamicComponent('VSCodeButton');
export const VSCodeCheckbox = createDynamicComponent('VSCodeCheckbox');
export const VSCodeRadioGroup = createDynamicComponent('VSCodeRadioGroup');
export const VSCodeRadio = createDynamicComponent('VSCodeRadio');
export const VSCodeTextField = createDynamicComponent('VSCodeTextField');
export const VSCodeDropdown = createDynamicComponent('VSCodeDropdown');
export const VSCodeOption = createDynamicComponent('VSCodeOption');
export const VSCodeTag = createDynamicComponent('VSCodeTag');
export const VSCodeProgressRing = createDynamicComponent('VSCodeProgressRing');
export const VSCodePanels = createDynamicComponent('VSCodePanels');
export const VSCodePanelTab = createDynamicComponent('VSCodePanelTab');
export const VSCodePanelView = createDynamicComponent('VSCodePanelView');
export const VSCodeDivider = createDynamicComponent('VSCodeDivider');
export const VSCodeLink = createDynamicComponent('VSCodeLink');
export const VSCodeDataGrid = createDynamicComponent('VSCodeDataGrid');
export const VSCodeDataGridRow = createDynamicComponent('VSCodeDataGridRow');
export const VSCodeDataGridCell = createDynamicComponent('VSCodeDataGridCell');
