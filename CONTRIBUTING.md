# Contributing to CommentKit

Thank you for your interest in contributing to CommentKit! We welcome contributions from the community and are grateful for your support.

## Table of Contents

- [Contributing to CommentKit](#contributing-to-commentkit)
  - [Table of Contents](#table-of-contents)
  - [Code of Conduct](#code-of-conduct)
  - [How Can I Contribute?](#how-can-i-contribute)
    - [Reporting Bugs](#reporting-bugs)
    - [Suggesting Features](#suggesting-features)
    - [Submitting Pull Requests](#submitting-pull-requests)
  - [Development Setup](#development-setup)
    - [Prerequisites](#prerequisites)
    - [Initial Setup](#initial-setup)
    - [Running the backend](#running-the-backend)
    - [Running the frontend](#running-the-frontend)
    - [Testing the Widget](#testing-the-widget)
  - [Testing](#testing)
  - [Getting Help](#getting-help)
  - [License](#license)

## Code of Conduct

This project and everyone participating in it is expected to uphold a standard of respect and professionalism. Please be kind and courteous to others.

## How Can I Contribute?

### Reporting Bugs

Bug reports help make CommentKit better for everyone. When filing a bug report, please include:

- **Clear title and description** - Explain the problem clearly
- **Steps to reproduce** - Provide specific steps to reproduce the issue
- **Expected behavior** - What you expected to happen
- **Actual behavior** - What actually happened
- **Screenshots** - If applicable, add screenshots to help explain the problem
- **Environment** - Browser version, OS, etc.

[Create a bug report](https://github.com/ankushKun/commentkit/issues/new)

### Suggesting Features

We love to hear ideas for new features! When suggesting a feature:

- **Use a clear title** - Describe the feature concisely
- **Provide detailed description** - Explain why this feature would be useful
- **Include examples** - Show how the feature would work
- **Consider alternatives** - Mention any alternative solutions you've considered

[Request a feature](https://github.com/ankushKun/commentkit/issues/new)

### Submitting Pull Requests

We actively welcome your pull requests! Here's how to submit one:

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following our coding guidelines
3. **Test your changes** thoroughly
4. **Update documentation** if needed
5. **Submit a pull request** with a clear description of your changes

## Development Setup

### Prerequisites

- **Bun** 1.0 or higher ([install Bun](https://bun.sh))
- **Cloudflare account** (for deployment)

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ankushKun/commentkit.git
   cd commentkit
   ```

2. **Install dependencies for frontend**
   ```bash
   cd frontend
   bun install
   ```

3. **Install dependencies for worker**
   ```bash
   cd ../worker
   bun install
   ```

### Running the backend

1. **Start the worker**
   ```bash
   cd worker
   bun run dev
   ```

   This will create the required D1 db as well

2. **Setup DB**

   run migrations
   ```bash
   bun run db:migrate:local
   ```

3. **(Optional) Configure email for development**

   If you want to test email functionality locally, create an env file and add a RESEND api key
   ```bash
   touch .env
   echo "RESEND_API_KEY=your_api_key" >> .env
   ```

4. **Start the development server**
   ```bash
   bun run dev
   ```

   The API will be available at `http://localhost:8787`

### Running the frontend

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Start the development server**
   ```bash
   bun dev
   ```

   The frontend will be available at `http://localhost:3000`

   You can access:
   - Dashboard: `http://localhost:3000`
   - Widget test page: `http://localhost:3000/widget`
   - Bundle script: `http://localhost:3000/bundle.js`

### Testing the Widget

To test the embeddable widget locally:

1. **Ensure both servers are running**
   - Frontend: `http://localhost:3000` (serves the widget and bundle)
   - Worker: `http://localhost:8787` (API backend)

2. **Use the built-in test page**

   The easiest way is to use the example html already available in the frontend public directory
   ```
   http://localhost:3000/example.html
   ```

3. **Or create a custom test HTML file** (e.g., `test.html`)
   ```html
   <!DOCTYPE html>
   <html>
   <head>
       <title>CommentKit Test</title>
       <!-- Load the bundle -->
       <script src="http://localhost:3000/bundle.js"></script>
   </head>
   <body>
       <h1>Test Page</h1>
       <!-- Add the comments widget -->
       <div data-commentkit></div>

   </body>
   </html>
   ```

   Open the file in your browser to test the widget with the local API.


## Testing

Before submitting a pull request:

1. **Test all functionality** - Ensure your changes work as expected
2. **Test edge cases** - Think about what could go wrong
3. **Test across browsers** - If making frontend changes
4. **Check console** - No errors or warnings
5. **Test mobile** - Ensure responsive design works

## Getting Help

If you need help with contributing:

- **Open a discussion** on GitHub
- **Ask in issues** - Tag your question appropriately
- **Email us** at [commentkit@ankush.one](mailto:commentkit@ankush.one)
- **Discord** - Contact @ankushkun

It is recommended to use public channels for questions and discussions.

## License

By contributing to CommentKit, you agree that your contributions will be licensed under the [GNU General Public License v3.0](LICENSE).

---

Thank you for contributing to CommentKit! 🎉
