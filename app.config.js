module.exports = {
  "expo": {
    "name": "money-dey",
    "slug": "money-dey",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "moneydey",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/images/icon.png",
        "backgroundImage": "./assets/images/icon.png",
        "monochromeImage": "./assets/images/icon.png"
      },
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false,
      "package": "com.money_dey.com",
      "googleServicesFile": process.env.GOOGLE_SERVICES_JSON_PATH ?? "./google-services.json"
    },
    "web": {
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-screen.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff",
          "dark": {
            "backgroundColor": "#000000"
          }
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true,
      "reactCompiler": true
    },
    "extra": {
      "router": {},
      "eas": {
        "projectId": "ab96a838-39dc-4814-b73f-6c982ab907cc"
      }
    },
    "owner": "juniordcoder",
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/ab96a838-39dc-4814-b73f-6c982ab907cc"
    },
    "ios": {}
  }
}