const cloud = require('wx-server-sdk');

cloud.init({
  env: 'cloud1-9gbyqyqyb5f2cb69'
});

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  return {
    openid: wxContext.OPENID
  };
}; 