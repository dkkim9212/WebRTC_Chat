// Socket.IO 서버와 연결하는 코드
// 서버와 offer, answer, ice-candidate 같은 신호를 주고받을 때 사용
const socket = io()

// HTML에서 방 이름 입력창 가져오기
const roomInput = document.getElementById("roomInput")

// HTML에서 방 입장 버튼 가져오기
const joinBtn = document.getElementById("joinBtn")

// HTML에서 현재 상태를 보여줄 영역 가져오기
const statusText = document.getElementById("status")

// 내 화면을 보여줄 video 태그 가져오기
const localVideo = document.getElementById("localVideo")

// 상대방 화면을 보여줄 video 태그 가져오기
const remoteVideo = document.getElementById("remoteVideo")

// 현재 접속할 방 이름을 저장할 변수
let roomId = ""

// 내 카메라/마이크 스트림을 저장할 변수
let localStream = null

// 상대방 영상/음성 스트림을 저장할 변수
let remoteStream = null

// WebRTC 연결 객체를 저장할 변수
// 실제로 상대방과 영상/음성을 주고받는 핵심 객체
let peerConnection = null

// ICE Candidate가 너무 빨리 도착했을 때 임시로 저장하는 배열
// remoteDescription이 설정되기 전에 candidate가 오면 바로 추가하면 오류날 수 있음
let pendingCandidates = []

// WebRTC에서 사용할 STUN 서버 설정
// STUN 서버는 내 네트워크 주소를 찾는 데 도움을 줌
const iceServers = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302",
        },
    ],
}

// 서버와 소켓 연결이 되었는지 확인하는 코드
// 디버깅할 때는 켜두는 게 좋음
socket.on("connect", () => {
    console.log("소켓 연결됨:", socket.id)
})

// 방 입장 버튼을 클릭했을 때 실행
joinBtn.addEventListener("click", async () => {
    // 입력창에 적은 방 이름을 가져오고 앞뒤 공백 제거
    roomId = roomInput.value.trim()

    // 방 이름이 비어 있으면 경고 후 중단
    if (!roomId) {
        alert("방 이름을 입력하세요.")
        return
    }

    // 버튼을 여러 번 누르면 연결이 꼬일 수 있으므로 비활성화
    joinBtn.disabled = true

    // 화면에 현재 상태 표시
    statusText.textContent = "카메라 준비 중..."

    try {
        // 내 카메라/마이크 준비
        await prepareLocalStream()

        // WebRTC 연결 객체 생성
        createPeerConnection()

        // 상태 표시 변경
        statusText.textContent = "방 입장 중..."

        // 서버에 방 입장 요청
        socket.emit("join-room", roomId)
    } catch (error) {
        // 위 과정 중 오류가 나면 여기로 들어옴
        console.error("입장 오류:", error)

        // 오류 내용을 알림으로 표시
        alert(`입장 오류: ${error.name}\n${error.message}`)

        // 다시 입장 버튼을 누를 수 있게 활성화
        joinBtn.disabled = false
    }
})

// 내 카메라/마이크를 가져오는 함수
async function prepareLocalStream() {
    try {
        // 브라우저에 카메라와 마이크 사용 요청
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: {
                // 선택한 마이크가 있으면 해당 마이크 사용
                deviceId: selectedMicId ? { exact: selectedMicId } : undefined,

                // 에코 제거
                echoCancellation: { ideal: true },

                // 주변 소음 억제
                noiseSuppression: { ideal: true },

                // 자동 음량 조절
                autoGainControl: { ideal: true },

                // 음성 통화용으로 1채널 권장
                channelCount: { ideal: 1 },

                // 일반적인 WebRTC 음성 샘플레이트
                sampleRate: { ideal: 48000 },
            },
        })
    } catch (error) {
        // 카메라 또는 마이크가 없거나 권한 문제가 있으면 여기로 들어옴
        console.warn("카메라/마이크 가져오기 실패:", error.name, error.message)

        // 빈 MediaStream 생성
        localStream = new MediaStream()

        // 카메라가 없을 때 대신 보여줄 검은 화면 트랙 생성
        const blackTrack = createBlackVideoTrack()

        // 검은 화면 트랙 생성에 성공하면 localStream에 추가
        if (blackTrack) {
            localStream.addTrack(blackTrack)
        }
    }

    // 내 video 태그에 localStream 연결
    localVideo.srcObject = localStream

    // 내 마이크 소리가 내 스피커로 다시 나오지 않게 음소거
    localVideo.muted = true

    // 모바일 브라우저에서 video가 전체화면으로 강제 재생되지 않도록 설정
    localVideo.playsInline = true

    try {
        // 내 화면 재생
        await localVideo.play()
    } catch (error) {
        // 일부 브라우저에서 자동 재생이 막힐 수 있음
        console.warn("내 화면 재생 실패:", error.message)
    }
}

// 카메라가 없을 때 사용할 검은 화면 video track 생성 함수
function createBlackVideoTrack() {
    // canvas 생성
    const canvas = document.createElement("canvas")

    // canvas 크기 설정
    canvas.width = 640
    canvas.height = 360

    // canvas에 그림을 그리기 위한 2D context 가져오기
    const ctx = canvas.getContext("2d")

    // 배경색을 검은색으로 설정
    ctx.fillStyle = "black"

    // canvas 전체를 검은색으로 채움
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 글자 색상을 흰색으로 설정
    ctx.fillStyle = "white"

    // 글자 크기와 폰트 설정
    ctx.font = "32px Arial"

    // canvas 가운데쯤에 No Camera 문구 표시
    ctx.fillText("No Camera", 230, 180)

    // canvas를 영상 스트림처럼 변환
    // 5는 초당 프레임 수
    const stream = canvas.captureStream(5)

    // 만들어진 영상 스트림에서 video track 하나를 꺼내서 반환
    return stream.getVideoTracks()[0]
}

// WebRTC 연결 객체를 만드는 함수
function createPeerConnection() {
    // RTCPeerConnection 객체 생성
    // 이 객체가 상대방과 영상/음성을 주고받는 핵심 역할
    peerConnection = new RTCPeerConnection(iceServers)

    // 상대방 영상/음성을 담을 빈 MediaStream 생성
    remoteStream = new MediaStream()

    // 상대방 video 태그에 remoteStream 연결
    remoteVideo.srcObject = remoteStream

    // 모바일 브라우저 대응
    remoteVideo.playsInline = true

    // 내 localStream 안의 track들을 WebRTC 연결에 추가
    // video track, audio track 등이 들어갈 수 있음
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    })

    // 상대방의 track이 도착했을 때 실행됨
    peerConnection.ontrack = async (event) => {
        // event.track.kind는 "video" 또는 "audio"
        console.log("상대방 track 도착:", event.track.kind)

        // 이미 같은 track이 remoteStream에 들어가 있는지 확인
        const alreadyExists = remoteStream
            .getTracks()
            .some((track) => track.id === event.track.id)

        // 중복이 아니면 상대방 track을 remoteStream에 추가
        if (!alreadyExists) {
            remoteStream.addTrack(event.track)
        }

        try {
            // 상대방 video 태그 재생
            await remoteVideo.play()
        } catch (error) {
            console.warn("상대방 화면 재생 실패:", error.message)
        }
    }

    // 내 브라우저에서 ICE Candidate가 생성될 때 실행
    peerConnection.onicecandidate = (event) => {
        // candidate가 있을 때만 서버로 보냄
        if (event.candidate) {
            // 서버를 통해 상대방에게 ICE Candidate 전달
            socket.emit("ice-candidate", event.candidate)
        }
    }

    // WebRTC 연결 상태가 바뀔 때 실행
    peerConnection.onconnectionstatechange = () => {
        console.log("connectionState:", peerConnection.connectionState)

        // 화면에 연결 상태 표시
        statusText.textContent = `연결 상태: ${peerConnection.connectionState}`
    }

    // ICE 연결 상태가 바뀔 때 실행
    peerConnection.oniceconnectionstatechange = () => {
        console.log("iceConnectionState:", peerConnection.iceConnectionState)
    }
}

// 내가 첫 번째 입장자일 때 서버가 보내주는 이벤트
socket.on("room-created", () => {
    statusText.textContent = "방 생성 완료. 상대방을 기다리는 중..."
})

// 내가 두 번째 입장자일 때 서버가 보내주는 이벤트
socket.on("room-joined", async () => {
    statusText.textContent = "방 입장 완료. offer 생성 중..."

    // 두 번째 입장자가 offer를 만들어서 첫 번째 사람에게 보냄
    await createOffer()
})

// 첫 번째 입장자에게 상대방이 들어왔다는 것을 알려주는 이벤트
socket.on("peer-joined", () => {
    statusText.textContent = "상대방이 입장했습니다. 연결 대기 중..."
})

// offer를 생성하는 함수
async function createOffer() {
    try {
        // WebRTC 연결 요청서 생성
        const offer = await peerConnection.createOffer()

        // 내가 만든 offer를 내 브라우저에 저장
        await peerConnection.setLocalDescription(offer)

        // 서버를 통해 상대방에게 offer 전달
        socket.emit("offer", peerConnection.localDescription)
    } catch (error) {
        console.error("offer 생성 오류:", error)
    }
}

// 상대방에게서 offer를 받았을 때 실행
socket.on("offer", async (offer) => {
    try {
        statusText.textContent = "offer 받음. answer 생성 중..."

        // 상대방의 offer를 내 브라우저에 저장
        await peerConnection.setRemoteDescription(offer)

        // 혹시 미리 도착해서 대기 중인 ICE Candidate가 있으면 처리
        await addPendingCandidates()

        // offer에 대한 응답 answer 생성
        const answer = await peerConnection.createAnswer()

        // 내가 만든 answer를 내 브라우저에 저장
        await peerConnection.setLocalDescription(answer)

        // 서버를 통해 상대방에게 answer 전달
        socket.emit("answer", peerConnection.localDescription)
    } catch (error) {
        console.error("offer 처리 오류:", error)
    }
})

// 상대방에게서 answer를 받았을 때 실행
socket.on("answer", async (answer) => {
    try {
        statusText.textContent = "answer 받음. 연결 중..."

        // 상대방의 answer를 내 브라우저에 저장
        await peerConnection.setRemoteDescription(answer)

        // 혹시 대기 중인 ICE Candidate가 있으면 처리
        await addPendingCandidates()
    } catch (error) {
        console.error("answer 처리 오류:", error)
    }
})

// 상대방에게서 ICE Candidate를 받았을 때 실행
socket.on("ice-candidate", async (candidate) => {
    try {
        // peerConnection이 아직 없거나
        // remoteDescription이 아직 설정되지 않았다면
        // candidate를 바로 추가하지 않고 임시 저장
        if (!peerConnection || !peerConnection.remoteDescription) {
            pendingCandidates.push(candidate)
            return
        }

        // 상대방의 ICE Candidate를 WebRTC 연결에 추가
        await peerConnection.addIceCandidate(candidate)
    } catch (error) {
        console.error("ICE Candidate 오류:", error)
    }
})

// 임시 저장된 ICE Candidate들을 처리하는 함수
async function addPendingCandidates() {
    W
    // pendingCandidates 배열에 값이 남아 있는 동안 반복
    while (pendingCandidates.length > 0) {
        // 배열의 맨 앞 candidate를 꺼냄
        const candidate = pendingCandidates.shift()

        // WebRTC 연결에 candidate 추가
        await peerConnection.addIceCandidate(candidate)
    }
}

// 방 입장 오류가 났을 때 서버가 보내주는 이벤트
socket.on("room-error", (message) => {
    // 오류 메시지 알림
    alert(message)

    // 상태 표시
    statusText.textContent = message

    // 다시 방 입장 버튼을 누를 수 있게 활성화
    joinBtn.disabled = false
})

// 상대방이 나갔을 때 서버가 보내주는 이벤트
socket.on("peer-left", () => {
    statusText.textContent = "상대방이 나갔습니다."

    // 기존 상대방 스트림이 있으면 track들을 멈춤
    if (remoteStream) {
        remoteStream.getTracks().forEach((track) => track.stop())
    }

    // 새로운 빈 remoteStream 생성
    remoteStream = new MediaStream()

    // 상대방 화면 비우기
    remoteVideo.srcObject = remoteStream
})
