// components/agent-ui/index.js
import { checkConfig, randomSelectInitquestion, getCloudInstance, commonRequest } from "./tools";
import md5 from "./md5.js";
Component({
  properties: {
    chatMode: {
      type: String,
      value: "",
    },
    envShareConfig: {
      type: Object,
      value: {},
    },
    showBotAvatar: {
      type: Boolean,
      value: false,
    },
    presentationMode: {
      type: String,
      value: "",
    },
    agentConfig: {
      type: Object,
      value: {
        botId: String,
        allowUploadFile: Boolean,
        allowWebSearch: Boolean,
        allowPullRefresh: Boolean,
        allowUploadImage: Boolean,
        allowMultiConversation: Boolean,
        showToolCallDetail: Boolean,
      },
    },
    modelConfig: {
      type: Object,
      value: {
        modelProvider: String,
        quickResponseModel: String,
        // deepReasoningModel: String, // 待支持
        logo: String,
        welcomeMsg: String,
      },
    },
  },

  observers: {
    showWebSearchSwitch: function (showWebSearchSwitch) {
      this.setData({
        showFeatureList: showWebSearchSwitch,
      });
    },
  },

  data: {
    showMenu: false,
    tapMenuRecordId: "",
    isLoading: true, // 判断是否尚在加载中
    article: {},
    windowInfo: wx.getWindowInfo(),
    bot: {},
    inputValue: "",
    output: "",
    chatRecords: [],
    setPanelVisibility: false,
    questions: [],
    scrollTop: 0, // 文字撑起来后能滚动的最大高度
    viewTop: 0, // 根据实际情况，可能用户手动滚动，需要记录当前滚动的位置
    scrollTo: "", // 快速定位到指定元素，置底用
    scrollTimer: null, //
    manualScroll: false, // 当前为手动滚动/自动滚动
    showTools: false, // 展示底部工具栏
    showFileList: false, // 展示输入框顶部文件行
    showTopBar: false, // 展示顶部bar
    sendFileList: [],
    lastScrollTop: 0,
    showUploadFile: true,
    showUploadImg: true,
    showWebSearchSwitch: false,
    showPullRefresh: true,
    showToolCallDetail: true,
    showMultiConversation: true,
    useWebSearch: false,
    showFeatureList: false,
    chatStatus: 0, // 页面状态： 0-正常状态，可输入，可发送， 1-发送中 2-思考中 3-输出content中
    triggered: false,
    page: 1,
    size: 10,
    total: 0,
    refreshText: "下拉加载历史记录",
    contentHeightInScrollViewTop: 0, // scroll区域顶部固定区域高度
    shouldAddScrollTop: false,
    isShowFeedback: false,
    feedbackRecordId: "",
    feedbackType: "",
    textareaHeight: 50,
    defaultErrorMsg: "网络繁忙，请稍后重试!",
    curScrollHeight: 0,
    isDrawerShow: false,
    conversations: [],
    transformConversations: {},
    conversationPageOptions: {
      page: 1,
      size: 15,
      total: 0,
    },
    conversation: null,
    defaultConversation: null, // 旧结构默认会话
    fetchConversationLoading: false,
  },
  attached: async function () {
    const chatMode = this.data.chatMode;
    // 检查配置
    const [check, message] = checkConfig(chatMode, this.data.agentConfig, this.data.modelConfig);
    if (!check) {
      wx.showModal({
        title: "提示",
        content: message,
      });
      return;
    }
    // 初始化一次cloudInstance，它是单例的，后面不传参数也可以获取到
    const cloudInstance = await getCloudInstance(this.data.envShareConfig);
    if (chatMode === "bot") {
      const { botId } = this.data.agentConfig;
      const ai = cloudInstance.extend.AI;
      const bot = await ai.bot.get({ botId });
      // 新增错误提示
      if (bot.code) {
        wx.showModal({
          title: "提示",
          content: bot.message,
        });
        return;
      }

      // 初始化第一条记录为welcomeMessage
      const record = {
        content: bot.welcomeMessage || "你好，有什么我可以帮到你？",
        record_id: "record_id" + String(+new Date() + 10),
        role: "assistant",
        hiddenBtnGround: true,
      };
      const { chatRecords } = this.data;
      // 随机选取三个初始化问题
      const questions = randomSelectInitquestion(bot.initQuestions, 3);
      let {
        allowWebSearch,
        allowUploadFile,
        allowPullRefresh,
        allowUploadImage,
        showToolCallDetail,
        allowMultiConversation,
      } = this.data.agentConfig;
      console.log("allowWebSearch", allowWebSearch);
      allowWebSearch = allowWebSearch === undefined ? true : allowWebSearch;
      allowUploadFile = allowUploadFile === undefined ? true : allowUploadFile;
      allowPullRefresh = allowPullRefresh === undefined ? true : allowPullRefresh;
      allowUploadImage = allowUploadImage === undefined ? true : allowUploadImage;
      showToolCallDetail = showToolCallDetail === undefined ? true : showToolCallDetail;
      allowMultiConversation = allowMultiConversation === undefined ? true : allowMultiConversation;
      this.setData({
        bot,
        questions,
        chatRecords: chatRecords.length > 0 ? chatRecords : [record],
        showWebSearchSwitch: allowWebSearch,
        showUploadFile: allowUploadFile,
        showUploadImg: allowUploadImage,
        showPullRefresh: allowPullRefresh,
        showToolCallDetail: showToolCallDetail,
        showMultiConversation: allowMultiConversation,
      });
      console.log("bot", this.data.bot);
      if (chatMode === "bot" && this.data.bot.multiConversationEnable) {
        // 拉一次默认旧会话
        await this.fetchDefaultConversationList();
        // 拉一遍新会话列表
        await this.resetFetchConversationList();
      }
    }
    const topHeight = await this.calculateContentInTop();
    // console.log('topHeight', topHeight)
    this.setData({
      contentHeightInScrollViewTop: topHeight,
    });
  },
  methods: {
    handleCopyAll(e) {
      const { content } = e.currentTarget.dataset;
      wx.setClipboardData({
        data: content,
        success: () => {
          wx.showToast({
            title: "复制成功",
            icon: "success",
          });
          this.hideMenu();
        },
      });
    },
    handleEdit(e) {
      const { content } = e.currentTarget.dataset;
      this.setData({
        inputValue: content,
      });
      this.hideMenu();
    },
    handleLongPress(e) {
      const { id } = e.currentTarget.dataset;
      this.setData({
        showMenu: true,
        tapMenuRecordId: id,
      });
    },
    hideMenu() {
      this.setData({
        showMenu: false,
        tapMenuRecordId: "",
      });
    },
    // 点击页面其他地方隐藏菜单
    onTapPage() {
      if (this.data.showMenu) {
        this.hideMenu();
      }
    },
    transformToolName: function (str) {
      if (str) {
        const strArr = str.split("/");
        if (strArr[1]) {
          return strArr[1];
        } else if (strArr[0]) {
          return strArr[0];
        }
      }
      return "";
    },
    handleClickConversation: async function (e) {
      // 清除旧的会话聊天记录
      this.clearChatRecords();
      const { conversation } = e.currentTarget.dataset;
      this.setData({
        isDrawerShow: false,
        conversation: {
          conversationId: conversation.conversationId,
          title: conversation.title,
        },
        page: 1, // 重置历史记录分页参数
        size: 10,
      });
      this.handleRefresh();
      // // 拉取当前会话聊天记录
      // const res = await wx.cloud.extend.AI.bot.getChatRecords({
      //   botId: this.data.agentConfig.botId,
      //   pageNumber: this.data.page,
      //   pageSize: this.data.size,
      //   sort: "desc",
      //   conversationId: this.data.conversation?.conversationId || undefined,
      // });
      // if (res.recordList) {
      // }
    },
    fetchDefaultConversationList: async function () {
      try {
        if (this.data.bot.botId) {
          const res = await this.fetchConversationList(true, this.data.bot.botId);
          if (res) {
            const { data } = res;
            console.log("data default", data.code);
            if (data && !data.code) {
              console.log("data", data);
              this.setData({
                defaultConversation: data,
                conversations: [data],
                transformConversations: this.transformConversationList([data]),
                // conversationPageOptions: {
                //   ...this.data.conversationPageOptions,
                //   total: data.total,
                // },
              });
            }
          }
        }
      } catch (e) {
        console.log("fetchDefaultConversationList e", e);
      }
    },
    fetchConversationList: async function (isDefault, botId) {
      // const { token } = await cloudInstance.extend.AI.bot.tokenManager.getToken();
      if (this.data.fetchConversationLoading) {
        return;
      }

      return new Promise((resolve, reject) => {
        const { page, size } = this.data.conversationPageOptions;
        const limit = size;
        const offset = (page - 1) * size;
        this.setData({
          fetchConversationLoading: true,
        });

        commonRequest({
          path: `conversation/?botId=${botId}&limit=${limit}&offset=${offset}&isDefault=${isDefault}`,
          method: "GET",
          header: {},
          success: (res) => {
            console.log("conversation list res", res);
            resolve(res);
          },
          fail(e) {
            console.log("conversation list e", e);
            reject(e);
          },
          complete: () => {
            this.setData({
              fetchConversationLoading: false,
            });
            // wx.hideLoading();
          },
        });
      });
    },
    createConversation: async function () {
      // const cloudInstance = await getCloudInstance();
      // const { token } = await cloudInstance.extend.AI.bot.tokenManager.getToken();
      return new Promise((resolve, reject) => {
        commonRequest({
          path: `conversation`,
          header: {
            // Authorization: `Bearer ${token}`,
          },
          data: {
            botId: this.data.agentConfig.botId,
          },
          method: "POST",
          success: (res) => {
            console.log("create conversation res", res);
            resolve(res);
          },
          fail(e) {
            console.log("create conversation e", e);
            reject(e);
          },
        });
      });
    },
    clickCreateInDrawer: function () {
      this.setData({
        isDrawerShow: false,
      });
      this.createNewConversation();
    },
    createNewConversation: async function () {
      if (!this.data.bot.multiConversationEnable) {
        wx.showModal({
          title: "提示",
          content: "请前往腾讯云开发平台启用 Agent 多会话模式",
        });
        return;
      }
      // // TODO: 创建新对话
      // const { data } = await this.createConversation();
      // console.log("createRes", data);
      this.clearChatRecords();
      // this.setData({
      //   conversation: {
      //     conversationId: data.conversationId,
      //     title: data.title,
      //   },
      // });
      this.setData({
        refreshText: "下拉加载历史记录",
      });
    },
    scrollConToBottom: async function (e) {
      console.log("scrollConToBottom", e);
      const { page, size } = this.data.conversationPageOptions;
      if (page * size >= this.data.conversationPageOptions.total) {
        return;
      }
      this.setData({
        conversationPageOptions: {
          ...this.data.conversationPageOptions,
          page: this.data.conversationPageOptions.page + 1,
        },
      });
      console.log("conversationPageOptions", this.data.conversationPageOptions);
      // 调用分页接口查询更多
      if (this.data.bot.botId) {
        const res = await this.fetchConversationList(false, this.data.bot.botId);
        if (res) {
          const { data } = res;
          if (data && !data.code) {
            const addConversations = [...this.data.conversations, ...data.data];
            // TODO: 临时倒序处理
            const sortConData = addConversations.sort(
              (a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
            );
            this.setData({
              conversations: sortConData,
              transformConversations: this.transformConversationList(sortConData),
            });
          }
        }
      }
    },
    resetFetchConversationList: async function () {
      this.setData({
        conversationPageOptions: {
          page: 1,
          size: 15,
          total: 0,
        },
      });
      try {
        if (this.data.bot.botId) {
          const res = await this.fetchConversationList(false, this.data.bot.botId);
          console.log("res", res);
          if (res) {
            const { data } = res;
            if (data && !data.code) {
              // TODO: 临时倒序处理
              const sortData = data.data.sort(
                (a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
              );
              console.log("sortData", sortData);
              const finalConData = this.data.defaultConversation
                ? sortData.concat(this.data.defaultConversation)
                : sortData;
              console.log("finalConData", finalConData);
              this.setData({
                conversations: finalConData,
                transformConversations: this.transformConversationList(finalConData),
                conversationPageOptions: {
                  ...this.data.conversationPageOptions,
                  total: data.total,
                },
              });
            }
          }
        }
      } catch (e) {
        console.log("fetchConversationList e", e);
      }
    },
    transformConversationList: function (conversations) {
      // 区分今天，本月，更早
      const todayCon = [];
      const curMonthCon = [];
      const earlyCon = [];
      const now = new Date();
      const todayDate = now.setHours(0, 0, 0, 0);
      const monthFirstDate = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      for (let item of conversations) {
        const itemDate = new Date(item.createTime).getTime();
        if (itemDate >= todayDate) {
          todayCon.push(item);
        } else if (itemDate >= monthFirstDate) {
          curMonthCon.push(item);
        } else {
          earlyCon.push(item);
        }
      }
      console.log("todayCon curMonthCon earlyCon", todayCon, curMonthCon, earlyCon);
      return {
        todayCon,
        curMonthCon,
        earlyCon,
      };
    },
    openDrawer: async function () {
      if (!this.data.bot.multiConversationEnable) {
        wx.showModal({
          title: "提示",
          content: "请前往腾讯云开发平台启用 Agent 多会话模式",
        });
        return;
      }
      this.setData({
        isDrawerShow: true,
        // conversationPageOptions: {
        //   ...this.data.conversationPageOptions,
        //   page: 1,
        //   size: 15,
        // },
      });

      // await this.fetchHistoryConversationData();
    },
    closeDrawer() {
      this.setData({
        isDrawerShow: false,
      });
    },
    showErrorMsg: function (e) {
      const { content, reqid } = e.currentTarget.dataset;
      // console.log("content", content);
      const transformContent =
        typeof content === "string"
          ? reqid
            ? `${content}|reqId:${reqid}`
            : content
          : JSON.stringify({ err: content, reqid });
      wx.showModal({
        title: "错误原因",
        content: transformContent,
        success() {
          wx.setClipboardData({
            data: transformContent,
            success: function (res) {
              wx.showToast({
                title: "复制错误完成",
                icon: "success",
              });
            },
          });
        },
      });
    },
    transformToolCallHistoryList: function (toolCallList) {
      const callParamsList = toolCallList.filter((item) => item.type === "tool-call");
      // const callResultList = toolCallList.filter(item => item.type === 'tool-result')
      const callContentList = toolCallList.filter((item) => item.type === "text");
      const transformToolCallList = [];
      for (let i = 0; i < callParamsList.length; i++) {
        const curParam = callParamsList[i];
        const curResult = toolCallList.find(
          (item) => item.type === "tool-result" && item.toolCallId === curParam.tool_call.id
        );
        const curContent = callContentList[i];
        const curError = toolCallList.find(
          (item) => item.finish_reason === "error" && item.error.message.toolCallId === curParam.tool_call.id
          // (item) => item.finish_reason === "error"
        );
        const transformToolCallObj = {
          id: curParam.tool_call.id,
          name: this.transformToolName(curParam.tool_call.function.name),
          callParams: "```json\n\n" + JSON.stringify(curParam.tool_call.function.arguments, null, 2) + "\n```",
          content: ((curContent && curContent.content) || "").replaceAll("\t", "").replaceAll("\n", "\n\n"),
        };
        if (curResult) {
          transformToolCallObj.callResult = "```json\n\n" + JSON.stringify(curResult.result, null, 2) + "\n```";
        }
        if (curError) {
          transformToolCallObj.error = curError;
        }

        transformToolCallList.push(transformToolCallObj);
      }
      return transformToolCallList;
    },
    handleLineChange: function (e) {
      // console.log("linechange", e.detail.lineCount);
      // 查foot-function height
      const self = this;
      const query = wx.createSelectorQuery().in(this);
      query
        .select(".foot_function")
        .boundingClientRect(function (res) {
          if (res) {
            self.setData({
              textareaHeight: res.height,
            });
          } else {
            // console.log("未找到指定元素");
          }
        })
        .exec();
    },
    openFeedback: function (e) {
      const { feedbackrecordid, feedbacktype } = e.currentTarget.dataset;
      let index = null;
      this.data.chatRecords.forEach((item, _index) => {
        if (item.record_id === feedbackrecordid) {
          index = _index;
        }
      });
      const inputRecord = this.data.chatRecords[index - 1];
      const answerRecord = this.data.chatRecords[index];
      // console.log(record)
      this.setData({
        isShowFeedback: true,
        feedbackRecordId: feedbackrecordid,
        feedbackType: feedbacktype,
        aiAnswer: answerRecord.content,
        input: inputRecord.content,
      });
    },
    closefeedback: function () {
      this.setData({ isShowFeedback: false, feedbackRecordId: "", feedbackType: "" });
    },
    // 滚动相关处理
    calculateContentHeight() {
      return new Promise((resolve) => {
        const query = wx.createSelectorQuery().in(this);
        query
          .selectAll(".main >>> .contentBox")
          .boundingClientRect((rects) => {
            let totalHeight = 0;
            rects.forEach((rect) => {
              totalHeight += rect.height;
            });
            resolve(totalHeight);
          })
          .exec();
      });
    },
    calculateContentInTop() {
      // console.log('执行top 部分计算')
      return new Promise((resolve) => {
        const query = wx.createSelectorQuery().in(this);
        query
          .selectAll(".main >>> .nav, .main >>> .tips")
          .boundingClientRect((rects) => {
            let totalHeight = 0;
            rects.forEach((rect) => {
              totalHeight += rect.height;
            });
            // console.log('top height', totalHeight);
            resolve(totalHeight);
          })
          .exec();
      });
    },
    onWheel: function (e) {
      // 解决小程序开发工具中滑动
      if (!this.data.manualScroll && e.detail.deltaY < 0) {
        this.setData({
          manualScroll: true,
        });
      }
    },
    onScroll: function (e) {
      if (e.detail.scrollTop < this.data.lastScrollTop) {
        // 鸿蒙系统上可能滚动事件，拖动事件失效，兜底处理
        this.setData({
          manualScroll: true,
        });
      }

      this.setData({
        lastScrollTop: e.detail.scrollTop,
      });

      // 针对连续滚动的最后一次进行处理，scroll-view的 scroll end事件不好判定
      if (this.data.scrollTimer) {
        clearTimeout(this.data.scrollTimer);
      }

      this.setData({
        scrollTimer: setTimeout(() => {
          const newTop = Math.max(this.data.scrollTop, e.detail.scrollTop);
          if (this.data.manualScroll) {
            this.setData({
              scrollTop: newTop,
            });
          } else {
            this.setData({
              scrollTop: newTop,
              viewTop: newTop,
            });
          }
        }, 100),
      });
    },
    handleScrollStart: function (e) {
      // console.log("drag start", e);
      if (e.detail.scrollTop > 0 && !this.data.manualScroll) {
        // 手动开始滚
        this.setData({
          manualScroll: true,
        });
      }
    },
    handleScrollToLower: function (e) {
      // console.log("scroll to lower", e);
      // 到底转自动
      this.setData({
        manualScroll: false,
      });
    },
    autoToBottom: function () {
      this.setData({
        manualScroll: false,
        scrollTo: "scroll-bottom",
      });
    },
    bindInputFocus: function (e) {
      this.setData({
        manualScroll: false,
      });
      this.autoToBottom();
    },
    bindKeyInput: function (e) {
      this.setData({
        inputValue: e.detail.value,
      });
    },
    handleRefresh: function (e) {
      if (this.data.triggered) {
        return;
      }
      console.log("开始刷新");
      this.setData(
        {
          triggered: true,
          refreshText: "刷新中",
        },
        async () => {
          // 模拟请求回数据后 停止加载
          // console.log('this.data.agentConfig.type', this.data.agentConfig.type)
          if (this.data.chatMode === "bot") {
            // 判断当前是否大于一条 （一条则为系统默认提示，直接从库里拉出最近的一页）
            if (this.data.chatRecords.length > 1) {
              const newPage = Math.floor(this.data.chatRecords.length / this.data.size) + 1;
              this.setData({
                page: newPage,
              });
            }
            const cloudInstance = await getCloudInstance(this.data.envShareConfig);
            const ai = cloudInstance.extend.AI;
            const getRecordsReq = {
              botId: this.data.agentConfig.botId,
              pageNumber: this.data.page,
              pageSize: this.data.size,
              sort: "desc",
            };
            if (this.data.conversation?.conversationId) {
              getRecordsReq.conversationId = this.data.conversation?.conversationId;
            }
            const res = await ai.bot.getChatRecords(getRecordsReq);
            if (res.recordList) {
              this.setData({
                total: res.total,
              });

              if (this.data.total === this.data.chatRecords.length - 1) {
                this.setData({
                  triggered: false,
                  refreshText: "到底啦",
                });
                return;
              }

              // 找出新获取的一页中，不在内存中的数据
              const freshNum = this.data.size - ((this.data.chatRecords.length - 1) % this.data.size);
              const freshChatRecords = res.recordList
                .reverse()
                .slice(0, freshNum)
                .map((item) => {
                  let transformItem = {
                    ...item,
                    record_id: item.recordId,
                  };
                  if (item.role === "user" && item.fileInfos) {
                    transformItem.fileList = item.fileInfos.map((item) => ({
                      status: "parsed",
                      rawFileName: item.fileName,
                      rawType: item.type,
                      fileId: item.cloudId,
                      fileSize: item.bytes,
                    }));
                  }
                  if (item.role === "assistant") {
                    if (item.content === "") {
                      transformItem.content = this.data.defaultErrorMsg;
                      transformItem.error = {};
                      transformItem.reqId = item.trace_id || "";
                    }

                    if (item.origin_msg) {
                      // console.log("toolcall origin_msg", JSON.parse(item.origin_msg));
                      const origin_msg_obj = JSON.parse(item.origin_msg);
                      if (origin_msg_obj.aiResHistory) {
                        const transformToolCallList = this.transformToolCallHistoryList(origin_msg_obj.aiResHistory);
                        transformItem.toolCallList = transformToolCallList;
                        const toolCallErr = transformToolCallList.find((item) => item.error)?.error;
                        // console.log("toolCallErr", toolCallErr);
                        if (toolCallErr?.error?.message) {
                          transformItem.error = toolCallErr.error.message;
                          transformItem.reqId = item.trace_id || "";
                        }
                      } else {
                        // 之前异常的返回
                        // return null
                      }
                    }
                  }
                  return transformItem;
                })
                .filter((item) => item);
              // 只有一条则一定是系统开头语，需要置前，否则则为真实对话，靠后
              this.setData({
                chatRecords:
                  this.data.chatRecords.length === 1
                    ? [...this.data.chatRecords, ...freshChatRecords]
                    : [...freshChatRecords, ...this.data.chatRecords],
              });
              // console.log("totalChatRecords", this.data.chatRecords);
            }
            this.setData({
              triggered: false,
              refreshText: "下拉加载历史记录",
            });
          }
        }
      );
    },
    handleTapClear: function (e) {
      this.clearChatRecords();
    },
    clearChatRecords: function () {
      console.log("执行清理");
      const chatMode = this.data.chatMode;
      const { bot } = this.data;
      this.setData({ showTools: false });
      if (chatMode === "model") {
        this.setData({
          chatRecords: [],
          chatStatus: 0,
        });
        return;
      }
      // 只有一条不需要清
      // if (this.data.chatRecords.length === 1) {
      //   return;
      // }
      const record = {
        content: bot.welcomeMessage || "你好，有什么我可以帮到你？",
        record_id: "record_id" + String(+new Date() + 10),
        role: "assistant",
        hiddenBtnGround: true,
      };
      const questions = randomSelectInitquestion(bot.initQuestions, 3);
      this.setData({
        chatRecords: [record],
        chatStatus: 0,
        questions,
        page: 1, // 重置分页页码
        conversation: null,
      });
    },
    chooseMedia: function (sourceType) {
      const self = this;
      wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: [sourceType],
        maxDuration: 30,
        camera: "back",
        success(res) {
          // console.log("res", res);
          // console.log("tempFiles", res.tempFiles);
          const isImageSizeValid = res.tempFiles.every((item) => item.size <= 30 * 1024 * 1024);
          if (!isImageSizeValid) {
            wx.showToast({
              title: "图片大小30M限制",
              icon: "error",
            });
            return;
          }
          const tempFiles = res.tempFiles.map((item) => {
            const tempFileInfos = item.tempFilePath.split(".");
            const tempFileName = md5(tempFileInfos[0]) + "." + tempFileInfos[1];
            return {
              tempId: tempFileName,
              rawType: item.fileType, // 微信选择默认的文件类型 image/video/file
              tempFileName: tempFileName, // 文件名
              rawFileName: "", // 图片类不带源文件名
              tempPath: item.tempFilePath,
              fileSize: item.size,
              fileUrl: "",
              fileId: "",
              botId: self.data.agentConfig.botId,
              status: "",
            };
          });

          const finalFileList = [...tempFiles];
          // console.log("final", finalFileList);
          self.setData({
            sendFileList: finalFileList, //
          });
          if (finalFileList.length) {
            self.setData({
              showTools: false,
            });
            if (!self.data.showFileList) {
              self.setData({
                showFileList: true,
              });
            }
          }
        },
      });
    },
    handleUploadImg: function (sourceType) {
      if (!this.data.bot.searchFileEnable) {
        wx.showModal({
          title: "提示",
          content: "请前往腾讯云开发平台启用 Agent 文件上传功能",
        });
        return;
      }
      if (this.data.useWebSearch) {
        wx.showModal({
          title: "提示",
          content: "联网搜索不支持上传文件/图片",
        });
        return;
      }
      const self = this;
      const isCurSendFile = this.data.sendFileList.find((item) => item.rawType === "file");
      if (isCurSendFile) {
        wx.showModal({
          title: "确认替换吗",
          content: "上传图片将替换当前文件内容",
          showCancel: "true",
          cancelText: "取消",
          confirmText: "确认",
          success(res) {
            // console.log("res", res);
            self.chooseMedia(sourceType);
          },
          fail(error) {
            // console.log("choose file e", error);
          },
        });
      } else {
        self.chooseMedia(sourceType);
      }
    },
    chooseMessageFile: function () {
      // console.log("触发choose");
      const self = this;
      const oldFileLen = this.data.sendFileList.filter((item) => item.rawType === "file").length;
      // console.log("oldFileLen", oldFileLen);
      const subFileCount = oldFileLen <= 5 ? 5 - oldFileLen : 0;
      if (subFileCount === 0) {
        wx.showToast({
          title: "文件数量限制5个",
          icon: "error",
        });
        return;
      }
      wx.chooseMessageFile({
        count: subFileCount,
        type: "file",
        success(res) {
          // tempFilePath可以作为img标签的src属性显示图片
          // const tempFilePaths = res.tempFiles;
          // console.log("res", res);
          // 检验文件后缀
          const isFileExtValid = res.tempFiles.every((item) => self.checkFileExt(item.name.split(".")[1]));
          if (!isFileExtValid) {
            wx.showModal({
              content: "当前支持文件类型为 pdf、txt、doc、docx、ppt、pptx、xls、xlsx、csv",
              showCancel: false,
              confirmText: "确定",
            });
            return;
          }
          // 校验各文件大小是否小于10M
          const isFileSizeValid = res.tempFiles.every((item) => item.size <= 10 * 1024 * 1024);
          if (!isFileSizeValid) {
            wx.showToast({
              title: "单文件10M限制",
              icon: "error",
            });
            return;
          }
          const tempFiles = res.tempFiles.map((item) => {
            const tempFileInfos = item.path.split(".");
            const tempFileName = md5(tempFileInfos[0]) + "." + tempFileInfos[1];
            return {
              tempId: tempFileName,
              rawType: item.type, // 微信选择默认的文件类型 image/video/file
              tempFileName: tempFileName, // 文件名
              rawFileName: item.name,
              tempPath: item.path,
              fileSize: item.size,
              fileUrl: "",
              fileId: "",
              botId: self.data.agentConfig.botId,
              status: "",
            };
          });
          // 过滤掉已选择中的 image 文件（保留file)
          const filterFileList = self.data.sendFileList.filter((item) => item.rawType !== "image");
          const finalFileList = [...filterFileList, ...tempFiles];
          console.log("final", finalFileList);

          self.setData({
            sendFileList: finalFileList, //
          });

          if (finalFileList.length) {
            self.setData({
              showTools: false,
            });
            if (!self.data.showFileList) {
              self.setData({
                showFileList: true,
              });
            }
          }
        },
        fail(e) {
          console.log("choose e", e);
        },
      });
    },
    handleUploadMessageFile: function () {
      // 判断agent 配置是否打开上传文件
      if (!this.data.bot.searchFileEnable) {
        wx.showModal({
          title: "提示",
          content: "请前往腾讯云开发平台启用 Agent 文件上传功能",
        });
        return;
      }
      if (this.data.useWebSearch) {
        wx.showModal({
          title: "提示",
          content: "联网搜索不支持上传文件/图片",
        });
        return;
      }

      const self = this;
      const isCurSendImage = this.data.sendFileList.find((item) => item.rawType === "image");
      if (isCurSendImage) {
        wx.showModal({
          title: "确认替换吗",
          content: "上传文件将替换当前图片内容",
          showCancel: "true",
          cancelText: "取消",
          confirmText: "确认",
          success(res) {
            console.log("res", res);
            self.chooseMessageFile();
          },
          fail(error) {
            console.log("choose file e", error);
          },
        });
      } else {
        self.chooseMessageFile();
      }
    },
    handleAlbum: function () {
      this.handleUploadImg("album");
    },
    handleCamera: function () {
      this.handleUploadImg("camera");
    },
    checkFileExt: function (ext) {
      return ["pdf", "txt", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv"].includes(ext);
    },
    stop: function () {
      this.autoToBottom();
      const { chatRecords, chatStatus } = this.data;
      const newChatRecords = [...chatRecords];
      const record = newChatRecords[newChatRecords.length - 1];
      if (chatStatus === 1) {
        record.content = "已暂停生成";
      }
      // 暂停思考
      if (chatStatus === 2) {
        record.pauseThinking = true;
      }
      this.setData({
        chatRecords: newChatRecords,
        manualScroll: false,
        chatStatus: 0, // 暂停之后切回正常状态
      });
    },
    openSetPanel: function () {
      this.setData({ setPanelVisibility: true });
    },
    closeSetPanel: function () {
      this.setData({ setPanelVisibility: false });
    },
    handleSendMessage: async function (event) {
      // 发送消息前校验所有文件上传状态
      if (this.data.sendFileList.some((item) => !item.fileId || item.status !== "parsed")) {
        wx.showToast({
          title: "文件上传解析中",
          icon: "error",
        });
        return;
      }
      await this.sendMessage(event);
    },
    sendMessage: async function (event) {
      if (this.data.showFileList) {
        this.setData({
          showFileList: !this.data.showFileList,
        });
      }
      if (this.data.showTools) {
        this.setData({
          showTools: !this.data.showTools,
        });
      }
      const { message } = event.currentTarget.dataset;
      let { inputValue, bot, agentConfig, chatRecords, chatStatus, modelConfig } = this.data;
      // 如果正在进行对话，不让发送消息
      if (chatStatus !== 0) {
        return;
      }
      // 将传进来的消息给到inputValue
      if (message) {
        inputValue = message;
      }
      // 空消息返回
      if (!inputValue) {
        return;
      }

      const chatMode = this.data.chatMode;
      // console.log(inputValue,bot.botId)
      const userRecord = {
        content: inputValue,
        record_id: "record_id" + String(+new Date() - 10),
        role: "user",
        fileList: this.data.sendFileList,
      };
      if (this.data.sendFileList.length) {
        this.setData({
          sendFileList: [],
        });
      }
      const record = {
        content: "",
        record_id: "record_id" + String(+new Date() + 10),
        role: "assistant",
        hiddenBtnGround: true,
      };
      this.setData({
        inputValue: "",
        questions: [],
        chatRecords: [...chatRecords, userRecord, record],
        chatStatus: 1, // 聊天状态切换为1发送中
      });

      // 新增一轮对话记录时 自动往下滚底
      this.autoToBottom();
      if (chatMode === "bot") {
        const cloudInstance = await getCloudInstance(this.data.envShareConfig);
        const ai = cloudInstance.extend.AI;
        // const ai = wx.cloud.extend.AI;
        // 区分当前是旧的单会话模式 or 新的多会话模式
        let res;
        if (!this.data.bot.multiConversationEnable) {
          // 单会话
          res = await ai.bot.sendMessage({
            data: {
              botId: bot.botId,
              msg: inputValue,
              files: this.data.showUploadFile ? userRecord.fileList.map((item) => item.fileId) : undefined,
              searchEnable: this.data.useWebSearch,
            },
          });
        } else {
          // 多会话
          if (!this.data.conversation && this.data.bot.multiConversationEnable) {
            // 发消息前构造新会话
            try {
              const { data } = await this.createConversation();
              this.setData({
                conversation: {
                  conversationId: data.conversationId,
                  title: data.title,
                },
              });
            } catch (e) {
              console.log("createConversation e", e);
            }
          }

          const sendReq = {
            botId: bot.botId,
            msg: inputValue,
            files: this.data.showUploadFile ? userRecord.fileList.map((item) => item.fileId) : undefined,
            searchEnable: this.data.useWebSearch,
          };

          if (this.data.conversation?.conversationId) {
            sendReq.conversationId = this.data.conversation.conversationId;
          }

          res = await ai.bot.sendMessage({
            data: sendReq,
          });
          // 当前已产生新会话，重刷一遍
          await this.resetFetchConversationList();
        }
        let contentText = "";
        let reasoningContentText = "";
        let isManuallyPaused = false; //这个标记是为了处理手动暂停时，不要请求推荐问题，不显示下面的按钮
        let startTime = null; //记录开始思考时间
        let endTime = null; // 记录结束思考时间
        let index = 0;
        for await (let event of res.eventStream) {
          const { chatStatus } = this.data;
          if (chatStatus === 0) {
            isManuallyPaused = true;
            break;
          }
          if (index % 10 === 0) {
            // 更新频率降为1/10
            this.toBottom(40);
          }
          const { data } = event;
          if (data === "[DONE]") {
            break;
          }
          try {
            const dataJson = JSON.parse(data);
            const {
              type,
              content,
              reasoning_content,
              record_id,
              search_info,
              role,
              knowledge_meta,
              knowledge_base,
              finish_reason,
              search_results,
              error,
            } = dataJson;
            const newValue = [...this.data.chatRecords];
            // 取最后一条消息更新
            const lastValueIndex = newValue.length - 1;
            const lastValue = newValue[lastValueIndex];
            lastValue.role = role || "assistant";
            lastValue.record_id = record_id;
            // 优先处理错误,直接中断
            if (finish_reason === "error" || finish_reason === "content_filter") {
              lastValue.search_info = null;
              lastValue.reasoning_content = "";
              lastValue.knowledge_meta = [];
              lastValue.content = this.data.defaultErrorMsg;
              if (error && error.message) {
                lastValue.error = error.message;
                this.setData({
                  [`chatRecords[${lastValueIndex}].error`]: lastValue.error,
                });
                if (lastValue.toolCallList && lastValue.toolCallList.length) {
                  let errToolCallObj = null;
                  if (typeof error.message === "string") {
                    errToolCallObj = lastValue.toolCallList[lastValue.toolCallList.length - 1];
                  } else {
                    if (error.message?.toolCallId) {
                      errToolCallObj = lastValue.toolCallList.find((item) => item.id === error.message.toolCallId);
                    }
                  }
                  if (errToolCallObj && !errToolCallObj.callResult) {
                    errToolCallObj.error = error;
                    this.setData({
                      [`chatRecords[${lastValueIndex}].toolCallList`]: lastValue.toolCallList,
                    });
                    this.autoToBottom();
                  }
                }
              }
              this.setData({
                [`chatRecords[${lastValueIndex}].search_info`]: lastValue.search_info,
                [`chatRecords[${lastValueIndex}].reasoning_content`]: lastValue.reasoning_content,
                [`chatRecords[${lastValueIndex}].knowledge_meta`]: lastValue.knowledge_meta,
                [`chatRecords[${lastValueIndex}].content`]: lastValue.content,
                [`chatRecords[${lastValueIndex}].record_id`]: lastValue.record_id,
              });
              // if (error) {
              //   lastValue.error = error;
              //   this.setData({
              //     [`chatRecords[${lastValueIndex}].error`]: lastValue.error,
              //   });
              // }
              break;
            }
            // 下面根据type来确定输出的内容
            // 只更新一次参考文献，后续再收到这样的消息丢弃
            if (type === "search" && !lastValue.search_info) {
              lastValue.search_info = search_info;
              this.setData({
                chatStatus: 2,
                [`chatRecords[${lastValueIndex}].search_info`]: lastValue.search_info,
                [`chatRecords[${lastValueIndex}].record_id`]: lastValue.record_id,
              }); // 聊天状态切换为思考中,展示联网的信息
            }
            // 思考过程
            if (type === "thinking") {
              if (!startTime) {
                startTime = +new Date();
                endTime = +new Date();
              } else {
                endTime = +new Date();
              }
              reasoningContentText += reasoning_content;
              lastValue.reasoning_content = reasoningContentText;
              lastValue.thinkingTime = Math.floor((endTime - startTime) / 1000);
              this.setData({
                [`chatRecords[${lastValueIndex}].reasoning_content`]: lastValue.reasoning_content,
                [`chatRecords[${lastValueIndex}].thinkingTime`]: lastValue.thinkingTime,
                [`chatRecords[${lastValueIndex}].record_id`]: lastValue.record_id,
                chatStatus: 2,
              }); // 聊天状态切换为思考中
            }
            // 内容
            if (type === "text") {
              // 区分是 toolCall 的content 还是普通的 content
              let isToolCallContent = false;
              const toolCallList = lastValue.toolCallList;
              if (toolCallList && toolCallList.length) {
                // const lastToolCallObj = toolCallList[toolCallList.length - 1];
                const findToolCallObj = toolCallList.find((item) => item.callParams && !item.callResult);
                if (findToolCallObj) {
                  isToolCallContent = true;
                  findToolCallObj.content += content.replaceAll("\t", "").replaceAll("\n", "\n\n");
                  this.setData({
                    [`chatRecords[${lastValueIndex}].toolCallList`]: lastValue.toolCallList,
                    chatStatus: 3,
                  });
                  this.autoToBottom();
                }
              }

              if (!isToolCallContent) {
                contentText += content;
                lastValue.content = contentText;
                this.setData({
                  [`chatRecords[${lastValueIndex}].content`]: lastValue.content,
                  [`chatRecords[${lastValueIndex}].record_id`]: lastValue.record_id,
                  chatStatus: 3,
                }); // 聊天状态切换为输出content中
              }
            }
            // 知识库，只更新一次
            if (type === "knowledge" && !lastValue.knowledge_meta) {
              // console.log('ryan',knowledge_base)
              lastValue.knowledge_base = knowledge_base;
              this.setData({
                [`chatRecords[${lastValueIndex}].knowledge_base`]: lastValue.knowledge_base,
                chatStatus: 2,
              });
            }
            // 数据库，只更新一次
            if (type === "db" && !lastValue.db_len) {
              lastValue.db_len = search_results.relateTables || 0;
              this.setData({
                [`chatRecords[${lastValueIndex}].db_len`]: lastValue.db_len,
                chatStatus: 2,
              });
            }
            // tool_call 场景，调用请求
            if (type === "tool-call") {
              const { tool_call } = dataJson;
              const callBody = {
                id: tool_call.id,
                name: this.transformToolName(tool_call.function.name),
                callParams: "```json\n" + JSON.stringify(tool_call.function.arguments, null, 2) + "\n```",
                content: "",
              };
              if (!lastValue.toolCallList) {
                lastValue.toolCallList = [callBody];
              } else {
                lastValue.toolCallList.push(callBody);
              }
              this.setData({
                [`chatRecords[${lastValueIndex}].toolCallList`]: lastValue.toolCallList,
              });
              this.autoToBottom();
            }
            // tool_call 场景，调用响应
            if (type === "tool-result") {
              const { toolCallId, result } = dataJson;
              if (lastValue.toolCallList && lastValue.toolCallList.length) {
                const lastToolCallObj = lastValue.toolCallList.find((item) => item.id === toolCallId);
                if (lastToolCallObj && !lastToolCallObj.callResult) {
                  lastToolCallObj.callResult = "```json\n" + JSON.stringify(result, null, 2) + "\n```";
                  this.setData({
                    [`chatRecords[${lastValueIndex}].toolCallList`]: lastValue.toolCallList,
                  });
                  this.autoToBottom();
                }
              }
            }
          } catch (e) {
            console.log("err", event, e);
            break;
          }
          index++;
        }
        this.toBottom(40);
        const newValue = [...this.data.chatRecords];
        const lastValueIndex = newValue.length - 1;
        // 取最后一条消息更新
        const lastValue = newValue[lastValueIndex];
        lastValue.hiddenBtnGround = isManuallyPaused;
        if (lastValue.content === "") {
          lastValue.content = this.data.defaultErrorMsg;
          this.setData({
            [`chatRecords[${lastValueIndex}].content`]: lastValue.content,
          });
        }
        this.setData({
          chatStatus: 0,
          [`chatRecords[${lastValueIndex}].hiddenBtnGround`]: isManuallyPaused,
        }); // 对话完成，切回0 ,并且修改最后一条消息的状态，让下面的按钮展示
        if (bot.isNeedRecommend && !isManuallyPaused) {
          const cloudInstance = await getCloudInstance(this.data.envShareConfig);
          const ai = cloudInstance.extend.AI;
          const chatRecords = this.data.chatRecords;
          const lastPairChatRecord = chatRecords.length >= 2 ? chatRecords.slice(chatRecords.length - 2) : [];
          const recommendRes = await ai.bot.getRecommendQuestions({
            data: {
              botId: bot.botId,
              history: lastPairChatRecord.map((item) => ({
                role: item.role,
                content: item.content,
              })),
              msg: inputValue,
              agentSetting: "",
              introduction: "",
              name: "",
            },
          });
          let result = "";
          for await (let str of recommendRes.textStream) {
            // this.toBottom();
            this.toBottom();
            result += str;
            this.setData({
              questions: result.split("\n").filter((item) => !!item),
            });
          }
        }
      }
      if (chatMode === "model") {
        const { modelProvider, quickResponseModel } = modelConfig;
        const cloudInstance = await getCloudInstance(this.data.envShareConfig);
        const ai = cloudInstance.extend.AI;
        const aiModel = ai.createModel(modelProvider);
        const res = await aiModel.streamText({
          data: {
            model: quickResponseModel,
            messages: [
              ...chatRecords.map((item) => ({
                role: item.role,
                content: item.content,
              })),
              {
                role: "user",
                content: inputValue,
              },
            ],
          },
        });
        let contentText = "";
        let reasoningText = "";
        let chatStatus = 2;
        let isManuallyPaused = false;
        let startTime = null; //记录开始思考时间
        let endTime = null; // 记录结束思考时间
        for await (let event of res.eventStream) {
          if (this.data.chatStatus === 0) {
            isManuallyPaused = true;
            break;
          }
          this.toBottom();

          const { data } = event;
          try {
            const dataJson = JSON.parse(data);
            const { id, choices = [] } = dataJson || {};
            const { delta, finish_reason } = choices[0] || {};
            if (finish_reason === "stop") {
              break;
            }
            const { content, reasoning_content, role } = delta;
            reasoningText += reasoning_content || "";
            contentText += content || "";
            const newValue = [...this.data.chatRecords];
            const lastValue = newValue[newValue.length - 1];
            lastValue.content = contentText;
            lastValue.reasoning_content = reasoningText;
            lastValue.record_id = "record_id" + String(id);
            if (!!reasoningText && !contentText) {
              // 推理中
              chatStatus = 2;
              if (!startTime) {
                startTime = +new Date();
                endTime = +new Date();
              } else {
                endTime = +new Date();
              }
            } else {
              chatStatus = 3;
            }
            lastValue.thinkingTime = endTime ? Math.floor((endTime - startTime) / 1000) : 0;
            this.setData({ chatRecords: newValue, chatStatus });
          } catch (e) {
            // console.log(e, event)
            break;
          }
        }
        const newValue = [...this.data.chatRecords];
        const lastValue = newValue[newValue.length - 1];
        lastValue.hiddenBtnGround = isManuallyPaused; // 用户手动暂停，不显示下面的按钮
        this.setData({ chatRecords: newValue, chatStatus: 0 }); // 回正
      }
    },
    toBottom: async function (unit) {
      const addUnit = unit === undefined ? 4 : unit;
      if (this.data.shouldAddScrollTop) {
        const newTop = this.data.scrollTop + addUnit;
        if (this.data.manualScroll) {
          this.setData({
            scrollTop: newTop,
          });
        } else {
          this.setData({
            scrollTop: newTop,
            viewTop: newTop,
          });
        }
        return;
      }
      // 只有当内容高度接近scroll 区域视口高度时才开始增加 scrollTop
      // const clientHeight =
      //   this.data.windowInfo.windowHeight - this.data.footerHeight - (this.data.chatMode === "bot" ? 40 : 0); // 视口高度
      const clientHeight = this.data.curScrollHeight; // TODO:
      // const contentHeight =
      //   (await this.calculateContentHeight()) +
      //   (this.data.contentHeightInScrollViewTop || (await this.calculateContentInTop())); // 内容总高度
      const contentHeight = await this.calculateContentHeight();
      // console.log(
      //   'contentHeight clientHeight newTop',
      //   contentHeight,
      //   clientHeight,
      //   this.data.scrollTop + 4
      // );
      if (clientHeight - contentHeight < 10) {
        this.setData({
          shouldAddScrollTop: true,
        });
      }
    },
    copyChatRecord: function (e) {
      // console.log(e)
      const { content } = e.currentTarget.dataset;
      wx.setClipboardData({
        data: content,
        success: function (res) {
          wx.showToast({
            title: "复制成功",
            icon: "success",
          });
        },
      });
    },
    addFileList: function () {
      // 顶部文件行展现时，隐藏底部工具栏
      this.setData({});
    },
    subFileList: function () {},
    copyUrl: function (e) {
      const { url } = e.currentTarget.dataset;
      console.log(url);
      wx.setClipboardData({
        data: url,
        success: function (res) {
          wx.showToast({
            title: "复制成功",
            icon: "success",
          });
        },
      });
    },
    handleRemoveChild: function (e) {
      // console.log("remove", e.detail.tempId);
      if (e.detail.tempId) {
        const newSendFileList = this.data.sendFileList.filter((item) => item.tempId !== e.detail.tempId);
        console.log("newSendFileList", newSendFileList);
        this.setData({
          sendFileList: newSendFileList,
        });
        if (newSendFileList.length === 0 && this.data.showFileList) {
          this.setData({
            showFileList: false,
          });
        }
      }
    },
    handleChangeChild: function (e) {
      console.log("change", e.detail);
      const { fileId, tempId, status } = e.detail;
      // const curFile = this.data.sendFileList.find(item => item.tempId === tempId)
      // curFile.fileId = fileId
      const newSendFileList = this.data.sendFileList.map((item) => {
        if (item.tempId === tempId) {
          const obj = {};
          if (fileId) {
            obj.fileId = fileId;
          }
          if (status) {
            obj.status = status;
          }
          return {
            ...item,
            ...obj,
          };
        }
        return item;
      });
      this.setData({
        sendFileList: newSendFileList,
      });
    },
    handleClickTools: function () {
      this.setData({
        showTools: !this.data.showTools,
      });
    },
    handleClickWebSearch: function () {
      if (!this.data.useWebSearch && !this.data.bot.searchEnable) {
        wx.showModal({
          title: "提示",
          content: "请前往腾讯云开发平台启用 Agent 联网搜索功能",
        });
        return;
      }
      if (this.data.sendFileList.length) {
        wx.showModal({
          title: "提示",
          content: "上传附件后不支持联网搜索",
        });
        return;
      }
      this.setData({
        useWebSearch: !this.data.useWebSearch,
      });
    },
  },
});
