$("#loading").hide();
// ----------------------- Function 區塊 --------------------------

// Function1: 取得 API 資料
const getApi = async (url, option) => {
  let response = await fetch(url, option);
  response = await response.json();

  return response.data;
};

// Function2: 動態製造 DOM 物件 (create p element for tags)
const createTags = (tagList, elementName) => {
  // 移除先前渲染過的 tags，避免重複渲染
  $(`.${elementName}`).remove();
  // 選擇要當模板的 element tag
  const $tagTemplete = $(`.templete-${elementName}`);

  // 選取要被插入 child 的 parant element
  const $parent = $(`#${elementName}s`);

  // 依據 tagList array 的長度，產生多少個 p element
  tagList.forEach((tag) => {
    // 複製出一個下拉式選單的 p element tag
    const $newDom = $tagTemplete.clone();
    $newDom
      .attr("class", `${elementName} ${tag.tag_id}`)
      .text(tag.title)
      .css("display", "inline");

    // 把新的 p element 加入 parant element
    $newDom.appendTo($parent);
  });
};

// Function3: 動態製造 DOM 物件 (create div for partner)
const createPartnerDiv = (roomId, partnerInfo) => {
  // 選取要被插入 child 的 parant element
  const $parent = $("#match");

  // 新建 button element
  const $div = $("<div>");
  const $img = $("<img>");

  // 大頭貼
  const $innerImg = $img.clone();
  $innerImg
    .attr("class", "partner-img h-12 object-cover rounded-full")
    .attr("src", partnerInfo.main_image);

  // 名字 + 最後訊息框
  const $inner2ndDiv = $div.clone();
  $inner2ndDiv.attr("class", "name-msg-container w-full text-lg font-semibold");

  // 名字
  const $innerNameDiv = $div.clone();
  $innerNameDiv
    .attr("id", roomId)
    .attr("class", "text-lg font-semibold")
    .text(partnerInfo.nick_name);

  $innerNameDiv.appendTo($inner2ndDiv);

  // 最外框 (少了 chatIndexId)
  const $outerDiv = $div.clone();
  $outerDiv
    .attr(
      "class",
      `partner ${partnerInfo.id} ${partnerInfo.indexId} flex flex-row py-4 px-2 items-center border-b-2`
    )
    .attr("id", roomId)
    .attr("onClick", `openChatroom($(this))`);

  // 把新的 div 加入 parant element
  $innerImg.appendTo($outerDiv);
  $inner2ndDiv.appendTo($outerDiv);
  $outerDiv.appendTo($parent);
};

// FIXME: Function4: 動態製造 DOM 物件 (create div for all partners) (chatIndexId 沒有用??)
const createAllPartnerDiv = (partners) => {
  // 選取要被插入 child 的 parant element
  const $parent = $("#match");

  // 新建 button element
  const $div = $("<div>");
  const $img = $("<img>");
  const $span = $("<span>");

  for (const partnerId in partners) {
    const chatroomInfo = partners[partnerId];

    const partnerName = chatroomInfo[0];
    const roomId = chatroomInfo[2];
    const chatIndexId = chatroomInfo[3];

    // 大頭貼
    const $innerImg = $img.clone();
    $innerImg
      .attr("class", "partner-img h-12 object-cover rounded-full")
      .attr("src", chatroomInfo[1]);

    // $innerImg.appendTo($inner1ndDiv);

    // 名字 + 最後訊息框
    const $inner2ndDiv = $div.clone();
    $inner2ndDiv.attr(
      "class",
      "name-msg-container w-full text-lg font-semibold"
    );

    // 名字
    const $innerNameDiv = $div.clone();
    $innerNameDiv
      .attr("id", roomId)
      .attr("class", "text-lg font-semibold")
      .text(partnerName);

    // 最後訊息
    const $innerMsg = $span.clone();
    $innerMsg.attr("class", "text-gray-500").text("哈囉，今天好嗎？");

    $innerNameDiv.appendTo($inner2ndDiv);
    // $innerMsg.appendTo($inner2ndDiv);

    // 最外框
    const $outerDiv = $div.clone();
    $outerDiv
      .attr(
        "class",
        `partner ${partnerId} ${chatIndexId} flex flex-row py-4 px-2 items-center border-b-2`
      )
      .attr("id", roomId)
      .attr("onClick", `openChatroom($(this))`);

    // 把新的 div 加入 parant element
    $innerImg.appendTo($outerDiv);
    $inner2ndDiv.appendTo($outerDiv);
    $outerDiv.appendTo($parent);
  }
};

// Function5: 動態製造 DOM 物件 (訊息分左右)
const createMessageBubble = (msg, ownerId, imgChunks) => {
  // 選取要被插入 child 的 parant element
  const $parent = $("#dialogue");

  // 新建 div & p
  const $div = $("<div>");
  const $p = $("<p>");
  // 依照傳訊息的人是誰，訊息分左右
  if (msg.userId == ownerId) {
    const $timestamp = $p.clone();
    $timestamp
      .attr("class", "text-right text-xs text-grey-dark mt-1")
      .text(msg.timestamp);

    // 包在外層的 div
    const $singleMsg = $div.clone();
    $singleMsg
      .attr("class", "rounded py-2 px-3 message-in-dialogue")
      .css("background-color", "#e2f7cb");
    const $wrapMsg = $div.clone();
    $wrapMsg.attr("class", "flex justify-end mb-2 wrap");

    if (msg.status) {
      // 如果是即時傳送照片
      const $img = $("<img>");
      $img
        .attr("src", "data:image/jpeg;base64," + window.btoa(imgChunks))
        .height(200);

      $singleMsg.append($img).append($timestamp);
    } else if (msg.message.includes(".jpg")) {
      // 如果是歷史訊息的照片
      const $img = $("<img>");
      $img.attr("src", `/${msg.message}`).height(200);

      $singleMsg.append($img).append($timestamp);
    } else {
      // 如果是純文字
      const $message = $p.clone();
      $message.attr("class", "text-sm mt-1").text(msg.message);

      $singleMsg.append($message).append($timestamp);
    }

    $wrapMsg.append($singleMsg);
    $wrapMsg.appendTo($parent);
  } else {
    const $name = $p.clone();
    $name.attr("class", "text-sm text-teal").text(msg.userName);
    const $timestamp = $p.clone();
    $timestamp
      .attr("class", "text-right text-xs text-grey-dark mt-1")
      .text(msg.timestamp);

    // 包在外層的 div
    const $singleMsg = $div.clone();
    $singleMsg
      .attr("class", "rounded py-2 px-3 message-in-dialogue")
      .css("background-color", "rgb(250, 238, 214)");
    const $wrapMsg = $div.clone();
    $wrapMsg.attr("class", "flex mb-2 wrap");

    if (msg.status) {
      // 如果是即時傳送照片
      const $img = $("<img>");
      $img
        .attr("src", "data:image/jpeg;base64," + window.btoa(imgChunks))
        .height(200);

      $singleMsg.append($name).append($img).append($timestamp);
    } else if (msg.message.includes(".jpg")) {
      // 如果是歷史訊息的照片
      const $img = $("<img>");
      $img.attr("src", `/${msg.message}`).height(200);

      $singleMsg.append($name).append($img).append($timestamp);
    } else {
      // 如果是純文字
      const $message = $p.clone();
      $message.attr("class", "text-sm mt-1").text(msg.message);

      $singleMsg.append($name).append($message).append($timestamp);
    }
    $wrapMsg.append($singleMsg);
    $wrapMsg.appendTo($parent);
  }
};

// Function6: 動態製造 DOM 物件 (create div for search result)
const createSearchResultDiv = (result) => {
  // 選取要被插入 child 的 parant element
  const $parent = $("#current");
  const $div = $("<div>");
  const $searchResultDiv = $div.clone();
  $searchResultDiv.css("display", "flex").css("flex-direction", "column");

  // 更換標題
  $("#current #more-info h3").text("相關搜尋結果");

  // 顯示取消圖示
  $("#cross").css("display", "inline");
  $("#partner-info").css("display", "none");

  if (!result.length) {
    const $outerDiv = $div.clone();
    $outerDiv.attr("class", "search-message text-xl text-center shadow-md");

    const $p = $("<p>");
    $p.text("沒有搜尋結果");
    $p.appendTo($outerDiv);
    $outerDiv.appendTo($searchResultDiv);
  } else {
    result.forEach((msg) => {
      // 新建搜尋筆數
      const $outerDiv = $div.clone();
      $outerDiv.attr("class", "search-message text-xl text-center shadow-md");
      const $inner1stDiv = $div.clone();
      $inner1stDiv
        .attr("class", "single-message")
        .text(`${msg.userName}: ${msg.message}`);

      const $inner2ndDiv = $div.clone();
      $inner2ndDiv.attr("class", "timestamp").text(msg.timestamp);

      // // 把複製出來的 div 加入 parent element
      $inner1stDiv.appendTo($outerDiv);
      $inner2ndDiv.appendTo($outerDiv);
      $outerDiv.appendTo($searchResultDiv);
    });
  }

  $searchResultDiv.appendTo($parent);
};
// Function7: 點擊特定 partner 開啟聊天室
const openChatroom = async function ($this) {
  const roomId = $this.attr("id");

  const $nameDiv = $this.children("div").last();
  const partnerName = $nameDiv.children("div").first().text();
  const classNames = $this.attr("class");
  const partnerId = classNames.split(" ")[1];

  // FIXME: 取得目前網址 (每次都要先清空對話框內容???)
  const currentUrl = window.location.href;
  let indexUrl;
  let newUrl;
  if (currentUrl.includes("?room=")) {
    // 如果原本在別的聊天室，就要替換掉 room id
    indexUrl = currentUrl.split("?room=")[0];
    newUrl = indexUrl + `?room=${roomId}`;
    $("#dialogue").children().remove();
  } else {
    // 如果在首頁，直接加 room id
    newUrl = currentUrl + `?room=${roomId}`;
    $("#dialogue").children().remove();
  }

  // 不跳轉網址
  window.history.pushState({}, "", newUrl);

  // 取得目前聊天者的詳細資訊
  socket.emit("ask-for-partner-info", partnerId);
  socket.on("get-partner-info", (msg) => {
    const { id, nick_name, main_image, sex_id, age, self_intro, tagList } = msg;

    $("#partner-name").text(nick_name);
    $("#partner-cantainer img").attr("src", main_image).attr("alt", nick_name);
    if (sex_id == 2) {
      $("#partner-sex")
        .attr("src", "./images/female.png")
        .attr("alt", "女性")
        .css("fill", "#FA76AD");
      $("#partner-age").text(age).css("color", "#FA76AD");
    } else if (sex_id == 1) {
      $("#partner-sex")
        .attr("src", "./images/male.png")
        .attr("alt", "男性")
        .css("fill", "#0086DE");
      $("#partner-age").text(age).css("color", "#0086DE");
    }

    $("#partner-intro").text(self_intro);

    // render tag title
    createTags(tagList, "tag");
  });

  // FIXME: 顯示出聊天室窗 (已經 "show" 了，為什麼還要改成 "flex")
  $("#connection").css("display", "none");
  $("#short-list").css("display", "none");
  $("#who-like-me").css("display", "none");
  $("#current-recommend").css("display", "none");
  $("#next-recommend-list").css("display", "none");
  $(".next-recommend").remove();
  $("#default").css("display", "none");
  $("#chat-block").css("display", "flex");
  $("#title").css("display", "flex");
  $("#dialogue").css("display", "flex");
  // $("#pass-msg").css("display", "flex");
  $("#partner-info").css("display", "block");
  $(".other-side").text(partnerName).attr("id", partnerId);
  $("#text-msg").css("display", "flex");
  $("#picture-msg").css("display", "flex");
  $("#current").css("display", "flex");
  $("#current #more-info h3").text("目前聊天者資訊");

  // 移除搜尋結果
  $(".search-message").remove();

  // 隱藏取消圖示
  $("#cross").css("display", "none");

  // 取得先前的對話紀錄 (改用 socketIO 取得??)
  const chatIndexId = classNames.split(" ")[2];

  const partnersUrl = `/api/1.0/chat/allrecord`;
  let fetchOption = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "",
  };
  fetchOption.body = JSON.stringify({ indexId: chatIndexId });

  const chatRecord = await getApi(partnersUrl, fetchOption);

  if (chatRecord) {
    chatRecord.forEach((record) => {
      const { userName, message, timestamp } = record;
      // 取得目前登入者是誰
      const ownerId = $(".user-name").attr("id");
      createMessageBubble(record, ownerId);
    });

    // 將聊天室窗滑到最底部的最新訊息
    const $dialogue = $("#dialogue");
    const dialogueHeight = $dialogue[0].scrollHeight;

    $dialogue.animate(
      {
        scrollTop: dialogueHeight,
      },
      "slow"
    );
  }
};

// Function8: [WebSocket] 使用者上傳照片
const upload = (roomId, partnerId, obj) => {
  console.log("partnerId:", partnerId);
  const files = obj.files;
  const [file] = files;
  // console.log("files:", files);

  const msg = { roomId, partnerId, file };

  socket.emit("upload", msg, (status) => {
    console.log("status:", status);
  });
};

// --------------------------- WebSocket 區塊 --------------------------------

let socket = null;

// 從 JWT token 取得使用者 id 去做 socketIO 連線
const token = localStorage.getItem("token");

const userApi = "/api/1.0/user/verify";
let fetchOption = {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
};

// 立即執行函式 (取出 localstorage 的 update key-value)
(async () => {
  const userData = await getApi(userApi, fetchOption);

  if (!userData) {
    // token 錯誤
    Swal.fire({
      icon: "warning",
      title: "您尚未登入喔！",
      text: "請再嘗試登入 / 註冊",
    }).then(() => {
      localStorage.removeItem("token");
      window.location.href = "/login.html";
    });
  } else {
    const { id, name, image } = userData;
    if (image) {
      $("#profile-img").attr("src", `images/${image}`).css("border", "none");
    }
    $(".user-name").text(name).attr("id", id);
    $("#chat-block").css("display", "none");
    $("#default").css("display", "block");

    // 建立一個 io 物件(?)，並連上 SocketIO server
    socket = io();

    // 傳送連線者資訊給 server
    const user = { id, name };

    // 如果該用戶是新註冊者，會傳送自己的資訊給其他使用者
    let update;
    if (localStorage.getItem("update")) {
      update = JSON.parse(localStorage.getItem("update"));
      user.update = update;

      localStorage.removeItem("update");
    }

    socket.emit("online", user);

    // 連線建立後
    socket.on("user-connect", async (msg) => {
      console.log("open connection to server");

      // 產生已配對成功的 partner 有誰
      const partnersUrl = `/api/1.0/user/partner`;
      let fetchOption = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "",
      };
      fetchOption.body = JSON.stringify({ userid: msg.id });
      const userPartnerList = await getApi(partnersUrl, fetchOption);
      const certainPartnerList = userPartnerList[0];
      createAllPartnerDiv(certainPartnerList);
    });

    // 對話呈現純文字 (訊息分左右)
    socket.on("room-broadcast", (msg) => {
      console.log(msg);

      // 取得目前登入者是誰
      const ownerId = $(".user-name").attr("id");
      createMessageBubble(msg, ownerId);

      // 將聊天室窗滑到最底部的最新訊息
      const $dialogue = $("#dialogue");
      const dialogueHeight = $dialogue[0].scrollHeight;

      $dialogue.animate(
        {
          scrollTop: dialogueHeight,
        },
        "slow"
      );
    });

    // 接收圖片
    let imgChunks = [];
    socket.on("file", async (chunk) => {
      // 把照片的 base64 編碼拼湊回來
      imgChunks.push(chunk);
    });

    // 呈現圖片 (訊息分左右)
    socket.on("wholeFile", (msg) => {
      console.log(msg);
      // 取得目前登入者是誰
      const ownerId = $(".user-name").attr("id");
      createMessageBubble(msg, ownerId, imgChunks);

      // 將聊天室窗滑到最底部的最新訊息
      const $dialogue = $("#dialogue");
      const dialogueHeight = $dialogue[0].scrollHeight;

      $dialogue.animate(
        {
          scrollTop: dialogueHeight,
        },
        "slow"
      );

      imgChunks = [];
    });

    // 顯示搜尋對話紀錄的結果
    socket.on("search-result", (result) => {
      console.log("result", result);
      createSearchResultDiv(result);
      $("#more-info").css("display", "flex").css("justify-content", "center");
      $("#cross").css("display", "flex");
    });

    socket.on("success-be-matched", (msg) => {
      const { userId, partnerInfo, roomId } = msg;
      createPartnerDiv(roomId, partnerInfo);

      let timerInterval;
      Swal.fire({
        title:
          "<h5 style='margin: 0'>" +
          `與 ${partnerInfo.nick_name} 成功配對！` +
          "</h5>",
        position: "top-end",
        showCloseButton: true,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: () => {
          const b = Swal.getHtmlContainer().querySelector("b");
          timerInterval = setInterval(() => {
            b.textContent = Swal.getTimerLeft();
          }, 100);
        },
        willClose: () => {
          clearInterval(timerInterval);
        },
        customClass: {
          title: "my-swal-title-class",
          cancelButton: "my-swal-cancel-button-class",
          container: "my-swal-container-class",
          popup: "my-swal-popup-class",
        },
      });
    });
  }
})();

// 點擊右上個人照人名跳轉到 profile page
$("#profile").click(function () {
  window.location.href = "/profile.html";
});

// 傳送文字
$("#btn-text").click(function (e) {
  e.preventDefault();

  if (socket === null) {
    alert("Please connect first");
    return;
  }

  // 取得網址的 params
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("room");

  if (!roomId) {
    alert("You have to get a chatroom id");
    return;
  }

  // const userName = $("#users option:selected").text();
  const partnerId = +$(".other-side").attr("id");
  const message = $("#message").val();
  const messages = { partnerId, roomId, message };

  socket.emit("message", messages);
  $("#message").val("");
});

// FIXME: 只要一選擇照片就上傳 (改成上傳到 S3)
$("#picture-upload").on("change", function (e) {
  if (socket === null) {
    alert("Please connect first");
    return;
  }

  // 取得網址的 params
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("room");

  if (!roomId) {
    alert("You have to get a chatroom id");
    return;
  }

  const partnerId = +$(".other-side").attr("id");

  upload(roomId, partnerId, e.target);
});

// 搜尋對話的關鍵字 (使用 socketIO 直接下 ES 指令??)
$("#btn-search").click(function (e) {
  e.preventDefault();

  if (socket === null) {
    alert("Please connect first");
    return;
  }

  // 移除先前搜尋結果
  $(".search-message").remove();

  const userId = +$(".user-name").attr("id");
  const partnerId = +$(".other-side").attr("id");
  const keyword = $("#keyword").val();
  const messages = { userId, partnerId, keyword };
  console.log("messages", messages);

  socket.emit("search", messages);
});

// 當關閉搜尋結果，會返回目前聊天者資訊
$("#cross").click(function () {
  // 更換標題
  $("#current #more-info h3").text("目前聊天者資訊");
  $("#partner-info").css("display", "block");

  // 移除搜尋結果
  $(".search-message").remove();

  // 隱藏取消圖示
  $("#cross").css("display", "none");
});

// 登出
$("#logout").click(function () {
  localStorage.removeItem("token");
  Swal.fire("登出成功！", "即將導回首頁", "success").then(() => {
    window.location.href = "/";
  });
});

// FIXME: 按圖示上傳照片 (改用 multer 上傳)
const uploadPicture = async () => {
  // 取得網址的 params
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("room");

  if (!roomId) {
    alert("You have to get a chatroom id");
    return;
  }

  const partnerId = +$(".other-side").attr("id");

  upload(roomId, partnerId, $picture[0]);
};
