Page({
  data: {
    schoolId: '',
    schoolInfo: {},
    majors: [],
    filteredMajors: [],
    activeTab: 'info',
    page: 1,
    pageSize: 10,
    hasMore: true,
    isLoading: false,
    searchKeyword: '',
    currentPage: 1,
    durationOptions: ['全部', '全日制', '非全日制'],
    degreeOptions: ['全部', '学硕', '专硕'],
    durationIndex: 0,
    degreeIndex: 0
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ schoolId: options.id })
      this.loadSchoolInfo()
      this.loadMajors()
    }
  },

  // 加载院校信息
  async loadSchoolInfo() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'school',
        data: {
          type: 'getSchoolDetail',
          data: {
            schoolId: this.data.schoolId
          }
        }
      })

      const { code, data, msg } = result.result
      
      if (code === 0 && data) {
        this.setData({ schoolInfo: data })
      } else {
        wx.showToast({
          title: msg || '加载失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('加载院校信息失败：', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
    this.filterMajors();
  },

  // 搜索确认
  onSearchConfirm(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
    this.filterMajors();
  },

  // 过滤专业列表
  filterMajors() {
    let filtered = this.data.majors;
    
    // 关键词搜索
    if (this.data.searchKeyword) {
      const keyword = this.data.searchKeyword.toLowerCase();
      filtered = filtered.filter(major => 
        major.code.toLowerCase().includes(keyword) || 
        major.name.toLowerCase().includes(keyword)
      );
    }

    // 学制筛选
    if (this.data.durationIndex > 0) {
      const duration = this.data.durationOptions[this.data.durationIndex];
      filtered = filtered.filter(major => major.duration === duration);
    }

    // 学位类型筛选
    if (this.data.degreeIndex > 0) {
      const degreeType = this.data.degreeOptions[this.data.degreeIndex];
      filtered = filtered.filter(major => major.degreeType === degreeType);
    }

    this.setData({
      filteredMajors: filtered
    });
  },

  // 加载专业列表
  async loadMajors() {
    if (this.data.isLoading || !this.data.hasMore) return
    
    this.setData({ isLoading: true })
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'major',
        data: {
          type: 'getMajors',
          data: {
            schoolId: this.data.schoolId,
            page: this.data.page,
            pageSize: this.data.pageSize
          }
        }
      })

      const { code, data, msg } = result.result
      
      if (code === 0 && data) {
        const newMajors = [...this.data.majors, ...data.list]
        this.setData({
          majors: newMajors,
          filteredMajors: newMajors,
          page: this.data.page + 1,
          hasMore: data.hasMore,
          isLoading: false
        })
      } else {
        this.setData({ isLoading: false })
        wx.showToast({
          title: msg || '加载失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('加载专业列表失败：', err)
      this.setData({ isLoading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
  },

  // 打开官网
  openWebsite() {
    if (this.data.schoolInfo.website) {
      wx.setClipboardData({
        data: this.data.schoolInfo.website,
        success: () => {
          wx.showToast({
            title: '链接已复制',
            icon: 'success'
          })
        }
      })
    }
  },

  // 点击专业
  onMajorTap(e) {
    const majorId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/school/major/detail/index?majorId=${majorId}&schoolId=${this.data.schoolId}`
    })
  },

  // 加载更多
  loadMore() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.setData({
        page: this.data.page + 1
      }, () => {
        this.loadMajors(true)
      })
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      page: 1
    }, () => {
      Promise.all([
        this.loadSchoolInfo(),
        this.loadMajors()
      ]).then(() => {
        wx.stopPullDownRefresh()
      })
    })
  },

  // 学制筛选变化
  onDurationChange(e) {
    const index = e.detail.value;
    this.setData({
      durationIndex: index
    });
    this.filterMajors();
  },

  // 学位类型筛选变化
  onDegreeChange(e) {
    const index = e.detail.value;
    this.setData({
      degreeIndex: index
    });
    this.filterMajors();
  }
}) 