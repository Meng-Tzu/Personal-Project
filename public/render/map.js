// ----------------------- Function 區塊 --------------------------

const tagTitles = {
  1: "吃貨",
  2: "貓奴",
  3: "寫 code",
  9: "裝文青",
  16: "運動仔",
  17: "看電影",
};

// Function1: 取得 API 資料
const getApi = async (url, option) => {
  let response = await fetch(url, option);
  response = await response.json();

  return response.data;
};

// Function2: 顯示地圖中心點
const markCenter = (
  socket,
  userCoordinate,
  zoom,
  name,
  image,
  potentialLocationList,
  pursuerList
) => {
  // 更換地圖中心點為使用者位置
  const map = L.map("map").setView(userCoordinate, zoom);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 14, // 最大可放大的 scale
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  // 客製 user Maker 圖示
  const userIcon = L.divIcon({
    className: "user-icon",
    html: `<img src="images/${image}" style="width: 50px; height: 50px; border-radius: 50%" />`,
    iconSize: [50, 50],
  });

  // add marker of user position
  const userMarker = L.marker(userCoordinate, {
    icon: userIcon,
  }).addTo(map);

  // popup setting user
  if (name === "台北車站") {
    userMarker.bindPopup(`<b>台北車站</b>`).openPopup();
  } else {
    userMarker.bindPopup(`<h1>${name}</h1><p>你在這!<p>`).openPopup();
  }

  for (const potential of potentialLocationList) {
    const location = JSON.parse(potential.location);
    if (!location) continue;

    const candidateMarker = L.marker(location, { userId: potential.id }).addTo(
      map
    );

    const tagIds = potential.tag_ids.split(",");
    let tags = "";

    tagIds.forEach((tagId) => {
      const tag = `<p>${tagTitles[+tagId]}</p>`;
      tags += tag;
    });

    // tooltip setting of candidate
    if (potential.id in pursuerList) {
      candidateMarker
        .bindTooltip(
          `<div id="like-signal">對方喜歡你唷！</div>
          <h1 class="pursuer">${potential.name}</h1>
          <img src="images/${potential.image}" />
          <div class="candidate-tags">${tags}</div>`,
          {
            direction: "bottom", // default: auto
            sticky: false, // true 跟著滑鼠移動。default: false
            permanent: false, // 是滑鼠移過才出現(false)，還是一直出現(true)
            opacity: 1.0,
            className: "leaflet-tooltip-own",
          }
        )
        .openTooltip();
    } else {
      candidateMarker
        .bindTooltip(
          `<h1>${potential.name}</h1>
          <img src="images/${potential.image}" />
          <div class="candidate-tags">${tags}</div>`,
          {
            direction: "bottom", // default: auto
            sticky: false, // true 跟著滑鼠移動。default: false
            permanent: false, // 是滑鼠移過才出現(false)，還是一直出現(true)
            opacity: 1.0,
            className: "leaflet-tooltip-own",
          }
        )
        .openTooltip();
    }

    // 被通知對方不喜歡自己，刪除對方
    socket.on("send-be-unlike-signal", (msg) => {
      const { unlikeId } = msg;
      if (candidateMarker.options.userId === +unlikeId) {
        map.removeLayer(candidateMarker);
      }
    });

    // 點擊 candidate 可以跑出詳細資訊
    candidateMarker.on("click", () => {
      const candidateId = candidateMarker.options.userId;
      socket.emit("map-candidate", candidateId);

      // 點擊喜歡後，關閉候選人資訊與把候選人從地圖刪除
      $("#btn-like")
        .unbind("click")
        .click(function () {
          $("main").removeClass("menu-active");
          $("#candidate-info").hide();

          if (socket === null) {
            alert("Please connect first");
            return;
          }

          const candidateId = $(".candidate-name").attr("id");
          if (candidateMarker.options.userId === +candidateId) {
            map.removeLayer(candidateMarker);
          }

          const userId = $(".user-name").attr("id");
          const userName = $(".user-name").text();
          const candidateName = $(".candidate-name").text();

          const messages = {
            isMap: true,
            userId,
            userName,
            candidateId,
            candidateName,
          };
          socket.emit("desired-candidate", messages);
        });

      // 點擊不喜歡後，關閉候選人資訊與把候選人從地圖刪除
      $("#unlike")
        .unbind("click")
        .click(function () {
          $("main").removeClass("menu-active");
          $("#candidate-info").hide();

          if (socket === null) {
            alert("Please connect first");
            return;
          }

          const unlikeId = $(".candidate-name").attr("id");
          if (candidateMarker.options.userId === +unlikeId) {
            map.removeLayer(candidateMarker);
          }

          const userId = $(".user-name").attr("id");
          const userName = $(".user-name").text();
          const unlikeName = $(".candidate-name").text();

          const messages = {
            isMap: true,
            userId,
            userName,
            unlikeId,
            unlikeName,
          };
          socket.emit("unlike", messages);
        });
    });
  }
};

// Function3: 顯示地圖中心位置
const showMyLocation = async (
  socket,
  zoom,
  name,
  image,
  potentialLocationList,
  pursuerList
) => {
  if (!navigator.geolocation) {
    Swal.fire({
      icon: "info",
      title: "您的瀏覽器不支援取得當前位置",
      text: "搜尋中心預設為台北車站",
    });

    markCenter(
      socket,
      [25.0480075, 121.5170613],
      zoom,
      "台北車站",
      image,
      potentialLocationList,
      pursuerList
    );
  }

  const success = async (position) => {
    const userCoordinate = [
      position.coords.latitude,
      position.coords.longitude,
    ];

    // 更新 DB 內使用者的當前位置
    const locationApi = "/api/1.0/user/location";
    const option = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "",
    };
    option.body = JSON.stringify({ location: userCoordinate });
    await getApi(locationApi, option);

    markCenter(
      socket,
      userCoordinate,
      zoom,
      name,
      image,
      potentialLocationList,
      pursuerList
    );
  };

  const error = () => {
    Swal.fire({
      icon: "info",
      title: "無法取得您的位置",
      text: "搜尋中心預設為台北車站",
    });

    markCenter(
      socket,
      [25.0480075, 121.5170613],
      zoom,
      "台北車站",
      image,
      potentialLocationList,
      pursuerList
    );
  };

  navigator.geolocation.getCurrentPosition(success, error);
};

// Function4: 動態製造 DOM 物件 (create p element for tags)
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

// ----------------------- Display Map ---------------------------
let socket = null;

// 從 JWT token 取得使用者 id
const token = localStorage.getItem("token");

const userApi = "/api/1.0/user/verify";
let fetchOption = {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
};

// 驗證 token
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
      return;
    });
  } else {
    const { id, name, image } = userData;
    if (image) {
      $("#profile-img").attr("src", `images/${image}`).css("border", "none");
    }
    $(".user-name").text(name).attr("id", id);

    // 連上 SocketIO server
    socket = io();
    // 傳送連線者資訊給 server
    const user = { id, name, isMap: true };
    socket.emit("online", user);

    // 連線建立後，取得推薦人選
    socket.on("user-connect", async (msg) => {
      console.log("open connection to server");
      if (!msg) {
        Swal.fire({
          icon: "info",
          title: "目前沒有符合的推薦人選喔！",
          text: "請填寫問卷或放寬篩選條件",
        });
        $("#map").text("目前沒有符合的推薦人選喔！");
        return;
      }

      // 標示出推薦人選的位置 (標出誰是追求者)
      const { pursuerList, potentialLocationList } = msg;

      // 詢問使用者是否能取得當前位置
      const zoom = 12;
      await showMyLocation(
        socket,
        zoom,
        name,
        image,
        potentialLocationList,
        pursuerList
      );
    });

    // 接收推薦人選的詳細資訊
    socket.on("map-candidate", (potentialInfo) => {
      const { id, nick_name, main_image, sex_id, age, self_intro, tags } =
        potentialInfo;

      $("#candidate-picture")
        .attr("src", `images/${main_image}`)
        .attr("alt", nick_name);
      $(".candidate-name").text(nick_name).attr("id", id);

      if (sex_id == 2) {
        $("#candidate-sex")
          .attr("src", "./images/female.png")
          .attr("alt", "女性")
          .css("fill", "#FA76AD");
        $("#candidate-age").text(age).css("color", "#FA76AD");
      } else if (sex_id == 1) {
        $("#candidate-sex")
          .attr("src", "./images/male.png")
          .attr("alt", "男性")
          .css("fill", "#0086DE");
        $("#candidate-age").text(age).css("color", "#0086DE");
      }

      createTags(tags, "tag");
      $("#candidate-intro").text(self_intro);

      $("main").addClass("menu-active");
      $("#candidate-info").show();
    });

    // 通知已傳送喜歡的訊息給對方
    socket.on("success-send-like-signal", (msg) => {
      const { candidateName } = msg;

      Swal.fire({
        position: "top",
        icon: "success",
        title: `已傳送喜歡的訊息給${candidateName}！`,
        showCloseButton: true,
        showConfirmButton: false,
        timer: 3000,
      });
    });

    // 通知已配對成功
    socket.on("success-match", (msg) => {
      Swal.fire({
        position: "top",
        icon: "success",
        showCloseButton: true,
        title: `與 ${msg.partnerName} 成功配對！`,
        text: "進入聊天室和對方打聲招呼吧！",
        showConfirmButton: false,
        timer: 3000,
      });
    });

    // 通知有人喜歡自己
    socket.on("who-like-me", (msg) => {
      Swal.fire({
        title:
          "<h5 style='margin: 0'>" + `${msg.pursuerName} 喜歡你！` + "</h5>",
        position: "top-end",
        showCloseButton: true,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        customClass: {
          title: "my-swal-title-class",
          cancelButton: "my-swal-cancel-button-class",
          container: "my-swal-container-class",
          popup: "my-swal-popup-class",
        },
      });
    });

    // 通知已被配對成功
    socket.on("success-be-matched", (msg) => {
      Swal.fire({
        position: "top",
        icon: "success",
        showCloseButton: true,
        title: `與 ${msg.partnerName} 成功配對！`,
        text: "進入聊天室和對方打聲招呼吧！",
        showConfirmButton: false,
        timer: 3000,
      });
    });

    // 通知再也見不到對方
    socket.on("send-unlike-signal", (msg) => {
      const { unlikeName } = msg;

      Swal.fire({
        position: "top",
        icon: "info",
        title: `再也見不到${unlikeName}囉！`,
        showCloseButton: true,
        showConfirmButton: false,
        timer: 3000,
      });
    });
  }
})();

$("#cross").click(function () {
  $("main").removeClass("menu-active");
  $("#candidate-info").hide();
});

// 點擊地圖重新載入
$(".map").click(function () {
  location.reload();
});

// 點擊右上個人照人名跳轉到 profile page
$("#profile").click(function () {
  window.location.href = "/profile.html";
});

// 登出
$("#logout").click(function () {
  localStorage.removeItem("token");
  Swal.fire("登出成功！", "即將導回首頁", "success").then(() => {
    window.location.href = "/";
  });
});
