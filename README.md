# Install OpenCart 4 Extension

![GitHub release (latest by date)](https://img.shields.io/github/v/release/brokeyourbike/opencart-install-action)
[![codecov](https://codecov.io/gh/brokeyourbike/opencart-install-action/graph/badge.svg?token=cZ4PCVhuuv)](https://codecov.io/gh/brokeyourbike/opencart-install-action)

A GitHub Action that automates the installation of `.ocmod.zip` extensions into an OpenCart 4 store. 

Because OpenCart 4 extensions require UI interaction to extract files from internal storage to the active directory, this action uses a headless Chromium browser (via Playwright) to log in, upload the zip, and trigger the extraction perfectly mimicking a real user.

It is highly optimized: it defaults to the runner's pre-installed system Chrome for zero-download speed, with a seamless fallback to downloading Playwright binaries if needed.

## Usage

Integrate this action into your CI/CD pipeline after spinning up your OpenCart testing environment.

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mariadb:10.6
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: opencart
        ports: ["3306:3306"]
        options: --health-cmd="mysqladmin ping"
    steps:
      - name: Checkout Code
        uses: actions/checkout@v6

      - name: Setup OpenCart 4
        uses: brokeyourbike/setup-opencart-action@v1
        with:
          oc-version: '4.1.0.3'
          db-password: 'root'
          admin-username: 'admin'
          admin-password: 'admin_pass'

      - name: Install Extension
        uses: brokeyourbike/opencart-install-action@v1
        with:
          store-url: 'http://localhost:8080'
          admin-username: 'admin'
          admin-password: 'admin_pass'
          zip-path: './my_vendor.ocmod.zip'
```

## Inputs

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `store-url` | No | `http://localhost:8080` | The base URL of your OpenCart store. |
| `admin-username` | No | `admin` | The username for the OpenCart admin account. |
| `admin-password` | **Yes** | | The password for the OpenCart admin account. |
| `zip-path` | **Yes** | | Relative or absolute path to the compiled `.ocmod.zip` file. |
