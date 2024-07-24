import React from 'react';

const ErrorMessageSection: React.FC = () => {
  return (
    <div
      className="error-message"
      id="errorMessage"
      style={{ display: 'none' }}
    >
      <span className="codicon codicon-error error-icon"></span>
      <span>There was an error generating the content. Please try again.</span>
    </div>
  );
};

export default ErrorMessageSection;
