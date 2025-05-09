# 考研复习微信小程序
本项目是基于微信小程序原生框架+微信云开发设计

要运行该小程序，请进行如下配置：

1. 在微信开发者工具中开通微信云开发，并记录下云环境ID

2. 将app.js文件中的`evn:"cloud-young-2gcblx0nb59a75fc"`替换为`evn:"你的云环境ID"`

3. 上传`cloudfunctions`文件夹下的所有云函数，选择`创建并部署：云端安装依赖（不上传node_modules)`

4. 创建云数据库集合

   ```
   books
   chat_messages
   collections
   comments
   countdown_days
   downloads
   likes_users
   majors
   news
   operation_logs
   plans
   posts
   resources
   schools
   scores
   tasks
   users
   ```

5. 需要自行添加的数据集合在 [Releases](https://github.com/Young-ZJ66/kaoyan-miniprogram/releases) 中下载，下载后在云数据库中导入到对应集合中即可

# Graduate Exam Preparation WeChat Mini Program
This project is developed based on the WeChat Mini Program native framework + WeChat Cloud Development.

To run this mini program, please follow these configuration steps:

1. Open WeChat Cloud Development in the WeChat Developer Tools and record your cloud environment ID

2. Replace `evn:"cloud-young-2gcblx0nb59a75fc"` in the app.js file with `evn:"your cloud environment ID"`

3. Upload all cloud functions in the `cloudfunctions` folder, select `Create and deploy: Install dependencies on the cloud (do not upload node_modules)`

4. Create the following cloud database collections:

   ```
   books
   chat_messages
   collections
   comments
   countdown_days
   downloads
   likes_users
   majors
   news
   operation_logs
   plans
   posts
   resources
   schools
   scores
   tasks
   users
   ```

5. The data collections that need to be added manually can be downloaded from [Releases](https://github.com/Young-ZJ66/kaoyan-miniprogram/releases). After downloading, import them into the corresponding collections in the cloud database.
