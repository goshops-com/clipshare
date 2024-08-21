# ClipShare

**ClipShare** is a serverless screen recording application built as an open-source alternative to Loom. It empowers users to effortlessly record their screens, optionally capture camera footage, and seamlessly upload the recordings to an S3-compatible storage service. Powered by Electron, ClipShare offers a cross-platform solution that's both powerful and easy to deploy.

![ClipShare Logo](https://github.com/goshops-com/clipshare/blob/main/icon.png?raw=true)

## 🚀 Features

- **📹 Screen Recording**: Capture your entire screen or specific windows with crystal-clear audio.
- **🎥 Camera Integration**: Add a personal touch by including your camera feed in recordings.
- **🚀 Auto-Launch**: Start ClipShare automatically when your system boots up.
- **🖥️ Tray Icon**: Quick access to ClipShare from your system tray for seamless workflow integration.
- **☁️ Serverless Architecture**: Upload recordings directly to an S3 bucket without the need for a backend server.
- **🛠️ Customizable**: Easily configure recording settings, storage options, and more.

## 🏁 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v14 or higher)
- [npm](https://www.npmjs.com/) (v6 or higher)
- An S3-compatible storage service (e.g., AWS S3, MinIO, DigitalOcean Spaces)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/clipshare.git
   cd clipshare
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:

   ```plaintext
   ACCESS_KEY=your_access_key
   ACCESS_SECRET=your_secret_key
   ENDPOINT=https://s3.yourservice.com
   REGION=us-east-1
   BUCKET_NAME=your-bucket-name
   ```

### Building the Application

To build ClipShare for your platform:

```bash
npm run build
```

This command packages the application and places it in the `dist/` directory.

### Running the Application

For development:

```bash
npm start
```

For production, run the packaged application from the `dist/` directory.

## 📘 Usage

1. **Launch**: Start ClipShare from your applications menu or use auto-launch.
2. **Access**: Click the tray icon to open the main interface.
3. **Record**: Choose your recording options and click "Start Recording".
4. **Stop**: Click "Stop Recording" when finished.
5. **Share**: After automatic upload, use the provided URL to share your recording.

## ⚙️ Configuration

Edit the `config.json` file to customize:

- Default recording settings
- Storage preferences
- UI themes
- Keyboard shortcuts

## 🛠️ Troubleshooting

- **Environment Variables**: Ensure your `.env` file is correctly formatted and in the root directory.
- **Auto-Launch Issues**: Check your system's startup application settings.
- **Recording Quality**: Adjust bitrate and resolution in the app settings for optimal performance.

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a new branch: `git checkout -b feature/your-feature-name`
3. Make your changes and commit them: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Submit a pull request

Please read our [Contributing Guidelines](CONTRIBUTING.md) for more details.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Electron](https://www.electronjs.org/) for making cross-platform desktop apps easy
- [AWS SDK](https://aws.amazon.com/sdk-for-javascript/) for S3 integration
- All our amazing contributors and users!

---

Built with ❤️ by the ClipShare team. Happy recording!
