// ----------------------- Function 區塊 --------------------------

// Function1: 取得 API 資料
const getApi = async (url, option) => {
  let response = await fetch(url, option);
  response = await response.json();

  return response.data;
};

// FIXME: Function2: 顯示地圖中心點
const markCenter = (
  socket,
  userCoordinate,
  zoom,
  name,
  image,
  potentialLocationList
) => {
  // 更換地圖中心點為使用者位置
  const map = L.map("map").setView(userCoordinate, zoom);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, // 最大可放大的 scale
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  // 客製 user Maker 圖示
  const userIcon = L.icon({
    iconUrl: `images/${image}`,
    iconSize: [42, 42],
  });

  // add marker of user position
  const userMarker = L.marker(userCoordinate, {
    icon: userIcon,
  }).addTo(map);

  // popup setting user
  if (name === "台北車站") {
    userMarker.bindPopup(`<b>台北車站</b>`).openPopup();
  } else {
    userMarker.bindPopup(`<b>${name}</b><br>你在這！`).openPopup();
  }

  for (const potential of potentialLocationList) {
    const location = JSON.parse(potential.location);
    if (!location) continue;

    const candidateMarker = L.marker(location, { userId: potential.id }).addTo(
      map
    );

    // 點擊 candidate 可以跑出詳細資訊
    candidateMarker.on("click", () => {
      const candidateId = candidateMarker.options.userId;
      socket.emit("map-candidate", candidateId);
    });

    // tooltip setting of candidate
    candidateMarker
      .bindTooltip(
        `<b>${potential.name}</b></br><img src="images/${potential.image}" style="height: 20px">`,
        {
          direction: "bottom", // default: auto
          sticky: false, // true 跟著滑鼠移動。default: false
          permanent: false, // 是滑鼠移過才出現(false)，還是一直出現(true)
          opacity: 1.0,
        }
      )
      .openTooltip();
  }

  // TODO: 客製化 display range
  L.circle(userCoordinate, {
    color: "#3f8aff",
    fillColor: "#3f8aff",
    fillOpacity: 0.5,
    radius: 1500,
  }).addTo(map);

  return map;
};

// Function3: 顯示地圖中心位置
const showMyLocation = async (
  socket,
  zoom,
  name,
  image,
  potentialLocationList
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
      potentialLocationList
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
      potentialLocationList
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
      potentialLocationList
    );
  };

  navigator.geolocation.getCurrentPosition(success, error);
};

// Function4: 動態製造 DOM 物件 (create p element for tags)
const createTags = (tagList, elementName) => {
  // 移除先前渲染過的 tags，避免重複渲染
  $(`.${elementName}s`).remove();
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
    const socket = io();
    // 傳送連線者資訊給 server
    const user = { id, name, isMap: true };
    socket.emit("online", user);

    // 連線建立後，取得推薦人選
    socket.on("user-connect", async (msg) => {
      console.log("open connection to server");
      const { potentialInfoList } = msg;

      if (!potentialInfoList.length) {
        Swal.fire({
          icon: "info",
          title: "目前沒有符合的推薦人選喔！",
          text: "請填寫問卷或放寬篩選條件",
        });
      }

      // TODO: 標示出推薦人選的位置 (標出誰是追求者)
      const { pursuerList, potentialLocationList } = msg;

      // 詢問使用者是否能取得當前位置
      const zoom = 14;
      await showMyLocation(socket, zoom, name, image, potentialLocationList);
    });

    // 接收推薦人選的詳細資訊
    socket.on("map-candidate", (potentialInfo) => {
      const { id, nick_name, main_image, sex_id, age, self_intro, tags } =
        potentialInfo;

      $("#candidate-picture")
        .attr("src", `images/${main_image}`)
        .attr("alt", nick_name);
      $("#candidate-name").text(nick_name);

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
    });
  }
})();

// TODO: 點擊聊天室導到聊天室頁面
$(".chatroom").click(function () {
  Swal.fire({
    icon: "info",
    title: "聊天室頁面功能待開發",
    text: "感謝您的耐心等待！",
  });
  // window.location.href = "/chatroom.html";
});

// 點擊地圖重新載入
$(".map").click(function () {
  location.reload();
});

// 登出
$("#logout").click(function () {
  localStorage.removeItem("token");
  window.location.href = "/login.html";
});
