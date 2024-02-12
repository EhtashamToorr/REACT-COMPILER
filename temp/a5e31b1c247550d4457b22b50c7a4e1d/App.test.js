
        import React from "react";
        import { render, screen } from "@testing-library/react";
        import App from "./App";
        import "@testing-library/jest-dom";

        test('Check 1', () => {
        render(<App />);
        const linkElement = screen.getByText(/learn react/i);
          expect(linkElement).toBeInTheDocument();
      });
      