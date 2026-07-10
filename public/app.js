// Socket.IO 서버와 연결하는 코드
// 서버와 offer, answer, ice-candidate 같은 신호를 주고받을 때 사용
const socket = io()

// HTML에서 방 이름 입력창 가져오기
const roomInput = document.getElementById("roomInput")

// HTML에서 방 입장 버튼 가져오기
const joinBtn = document.getElementById("joinBtn")
// 방 나가기 버튼 가져오기
const leaveBtn = document.getElementById("leaveBtn")

// HTML에서 현재 상태를 보여줄 영역 가져오기
const statusText = document.getElementById("status")

// 내 화면을 보여줄 video 태그 가져오기
const localVideo = document.getElementById("localVideo")

// 상대방 화면을 보여줄 video 태그 가져오기
const remoteVideo = document.getElementById("remoteVideo")

// 마이크 선택 select 가져오기
const micSelect = document.getElementById("micSelect")

// 스피커 선택 select 가져오기
const speakerSelect = document.getElementById("speakerSelect")

// 상대방 소리 조절 range 가져오기
const remoteVolume = document.getElementById("remoteVolume")

// 내 마이크 음량 조절 range 가져오기
const micVolume = document.getElementById("micVolume")

// 마이크 끄기/켜기 버튼 가져오기
const muteBtn = document.getElementById("muteBtn")

// 상대방 소리 끄기/켜기 버튼
const remoteMuteBtn = document.getElementById("remoteMuteBtn")

// 상대방 소리 아이콘
const remoteMuteIcon = document.getElementById("remoteMuteIcon")

// 화면 영역 가져오기
const videoStage = document.getElementById("videoStage")

// 상대방 화면 카드
const remoteCard = document.getElementById("remoteCard")

// 내 화면 카드
const localCard = document.getElementById("localCard")

// 음소거 아이콘
const muteIcon = document.getElementById("muteIcon")

// 오디오 설정 패널
const controlPanel = document.getElementById("controlPanel")

// 오디오 설정 열기 버튼
const controlToggleBtn = document.getElementById("controlToggleBtn")

// 오디오 설정 닫기 버튼
const controlCloseBtn = document.getElementById("controlCloseBtn")

// 오디오 설정 버튼 아이콘
const controlToggleIcon = document.getElementById("controlToggleIcon")
//화면 공유 버튼
const shareScreenBtn = document.getElementById("shareScreenBtn")

// 원래 카메라 트랙
let cameraVideoTrack = null

let fallbackVideoTrack = null

// 현재 화면 공유 트랙
let screenVideoTrack = null

// 화면 공유 중인지 확인
let isScreenSharing = false

// 선택한 마이크 id 저장
let selectedMicId = ""

// 선택한 스피커 id 저장
let selectedSpeakerId = ""

// 마이크가 꺼져있는지 상태 저장
let isMicMuted = false
// 상대방 소리가 꺼져있는지 상태 저장
let isRemoteMuted = false

// 상대방 소리 끄기 전에 사용하던 볼륨 저장
let lastRemoteVolumeBeforeMute = Number(remoteVolume.value || 0.5)

// 마이크 끄기 전에 사용하던 마이크 음량 저장
let lastMicVolumeBeforeMute = Number(micVolume.value || 1)

// 마이크 음량 조절용 Web Audio 객체
let audioContext = null
let micGainNode = null

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

let isJoining = false
let isInRoom = false

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
// 화면 공유 버튼 이벤트
shareScreenBtn.addEventListener("click", async () => {
    if (isScreenSharing) {
        await stopScreenShare()
    } else {
        await startScreenShare()
    }
})

// 방 입장 버튼을 클릭했을 때 실행
joinBtn.addEventListener("click", async () => {
    if (isJoining || isInRoom) {
        return
    }
    // 입력창에 적은 방 이름을 가져오고 앞뒤 공백 제거
    roomId = roomInput.value.trim()

    // 방 이름이 비어 있으면 경고 후 중단
    if (!roomId) {
        alert("방 이름을 입력하세요.")
        return
    }

    isJoining = true

    // 버튼을 여러 번 누르면 연결이 꼬일 수 있으므로 비활성화
    joinBtn.disabled = true
    leaveBtn.disabled = true

    // 화면에 현재 상태 표시
    statusText.textContent = "카메라 준비 중..."

    try {
        // 내 카메라/마이크 준비
        await prepareLocalStream()

        // WebRTC 연결 객체 생성
        createPeerConnection()

        // 상태 표시 변경
        statusText.textContent = "방 입장 중..."

        leaveBtn.disabled = false

        // 서버에 방 입장 요청
        socket.emit("join-room", roomId)


    } catch (error) {
        // 위 과정 중 오류가 나면 여기로 들어옴
        console.error("입장 오류:", error)

        alert(`입장 오류: ${error.name}\n${error.message}`)

        isJoining = false
        isInRoom = false
        roomId = ""

        joinBtn.disabled = false
        leaveBtn.disabled = true

        closePeerConnection()
        clearRemoteStream()
        stopLocalStream()
    }
})

// 가상 화면 장치 확인 함수
function isProbablyScreenDevice(track) {
    const label = (track?.label || "").toLowerCase()

    const screenWords = [
        "screen",
        "display",
        "capture",
        "virtual",
        "obs",
        "manycam",
        "xsplit",
        "화면",
        "스크린",
        "캡처",
        "가상",
    ]

    return screenWords.some((word) => label.includes(word))
}
// 내 카메라/마이크를 가져오는 함수
async function prepareLocalStream() {
    const tracks = []

    cameraVideoTrack = null
    fallbackVideoTrack = null

    // 1. 카메라만 따로 요청
    try {
        const cameraStream =
            await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: {
                        ideal: "user",
                    },
                },
                audio: false,
            })

        const videoTrack =
            cameraStream.getVideoTracks()[0] || null

        console.log(
            "선택된 영상 장치:",
            videoTrack?.label
        )

        console.log(
            "영상 설정:",
            videoTrack?.getSettings()
        )

        // 화면 캡처 또는 가상 카메라처럼 보이면 사용하지 않음
        if (
            videoTrack &&
            !isProbablyScreenDevice(videoTrack)
        ) {
            cameraVideoTrack = videoTrack
            tracks.push(cameraVideoTrack)
        } else {
            console.warn(
                "화면 캡처 또는 가상 장치로 판단되어 카메라로 사용하지 않습니다."
            )

            cameraStream
                .getTracks()
                .forEach((track) => track.stop())
        }
    } catch (error) {
        console.warn(
            "카메라 사용 불가:",
            error.name,
            error.message
        )
    }

    // 2. 실제 카메라가 없으면 검은 대체 트랙 사용
    if (!cameraVideoTrack) {
        fallbackVideoTrack = createBlackVideoTrack()

        if (fallbackVideoTrack) {
            tracks.push(fallbackVideoTrack)
        }
    }

    // 3. 마이크는 카메라와 별도로 요청
    try {
        let micStream =
            await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: getAudioConstraints(),
            })

        micStream =
            await applyMicGainToStream(micStream)

        const audioTrack =
            micStream.getAudioTracks()[0] || null

        if (audioTrack) {
            tracks.push(audioTrack)
        }
    } catch (error) {
        console.warn(
            "마이크 사용 불가:",
            error.name,
            error.message
        )
    }

    // 카메라 또는 검은 화면 + 마이크로 스트림 구성
    localStream = new MediaStream(tracks)

    localVideo.srcObject = localStream
    localVideo.muted = true
    localVideo.playsInline = true

    try {
        await localVideo.play()
    } catch (error) {
        console.warn(
            "내 화면 재생 실패:",
            error.message
        )
    }

    await loadMediaDevices()
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
    isJoining = false
    isInRoom = true

    joinBtn.disabled = true
    leaveBtn.disabled = false

    statusText.textContent = "방 생성 완료. 상대방을 기다리는 중..."
})

// 내가 두 번째 입장자일 때 서버가 보내주는 이벤트
socket.on("room-joined", async () => {
    isJoining = false
    isInRoom = true

    joinBtn.disabled = true
    leaveBtn.disabled = false

    statusText.textContent = "방 입장 완료. offer 생성 중..."

    if (!peerConnection && localStream) {
        createPeerConnection()
    }

    await createOffer()
})

// 첫 번째 입장자에게 상대방이 들어왔다는 것을 알려주는 이벤트
socket.on("peer-joined", () => {
    statusText.textContent = "상대방이 입장했습니다. 연결 대기 중..."

    if (!peerConnection && localStream) {
        createPeerConnection()
    }
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

        if (!peerConnection && localStream) {
            createPeerConnection()
        }
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
    console.warn("방 입장 오류:", message)

    statusText.textContent = message

    isJoining = false
    isInRoom = false
    roomId = ""

    closePeerConnection()
    clearRemoteStream()
    stopLocalStream()

    joinBtn.disabled = false
    leaveBtn.disabled = true

    alert(message)
})

// WebRTC 연결만 닫는 함수
function closePeerConnection() {
    if (!peerConnection) {
        return
    }

    peerConnection.ontrack = null
    peerConnection.onicecandidate = null
    peerConnection.onconnectionstatechange = null
    peerConnection.oniceconnectionstatechange = null

    peerConnection.close()
    peerConnection = null

    pendingCandidates = []
}

// 상대방 화면 비우기
function clearRemoteStream() {
    if (remoteStream) {
        remoteStream.getTracks().forEach((track) => {
            track.stop()
        })
    }

    remoteStream = new MediaStream()
    remoteVideo.srcObject = remoteStream
}

// 내 카메라/마이크 끄기
function stopLocalStream() {
    if (localStream) {
        localStream.getTracks().forEach((track) => {
            track.stop()
        })
    }

    localStream = null
    localVideo.srcObject = null

    if (audioContext) {
        audioContext.close()
    }

    audioContext = null
    micGainNode = null

    // 화면 공유 트랙이 남아 있으면 종료
    if (screenVideoTrack) {
        screenVideoTrack.stop()
    }

    // 카메라와 화면 공유 상태 초기화
    cameraVideoTrack = null
    screenVideoTrack = null
    isScreenSharing = false
    // 가상화면
    fallbackVideoTrack = null

    // 화면 공유 버튼 초기화
    shareScreenBtn.textContent = "화면 공유"
}

// 내가 방에서 나가는 함수
async function leaveRoom() {
    if (!isInRoom || !roomId) {
        return
    }

    // 화면 공유 중이면 먼저 화면 공유 종료
    // peerConnection을 닫기 전에 실행해야 함
    if (isScreenSharing || screenVideoTrack) {
        await stopScreenShare()
    }

    // 서버에 방 나가기 알림
    socket.emit("leave-room")

    // WebRTC 연결과 스트림 정리
    closePeerConnection()
    clearRemoteStream()
    stopLocalStream()

    roomId = ""
    isJoining = false
    isInRoom = false

    isMicMuted = false
    isRemoteMuted = false

    micVolume.value = lastMicVolumeBeforeMute || 1
    remoteVolume.value = lastRemoteVolumeBeforeMute || 0.5
    remoteVideo.volume = Number(remoteVolume.value)

    updateMuteButton()
    updateRemoteMuteButton()

    joinBtn.disabled = false
    leaveBtn.disabled = true

    statusText.textContent = "방에서 나갔습니다."
}

// 방 나가기 버튼 클릭
leaveBtn.addEventListener("click", async () => {
    const ok = confirm("방에서 나가시겠습니까?")

    if (!ok) {
        return
    }

    await leaveRoom()
})

// 상대방이 나갔을 때 서버가 보내주는 이벤트
socket.on("peer-left", () => {
    statusText.textContent = "상대방이 나갔습니다. 새 상대방을 기다리는 중..."

    closePeerConnection()
    clearRemoteStream()
})


// 마이크 옵션 만드는 함수
function getAudioConstraints() {
    return {
        // 선택한 마이크가 있으면 해당 마이크 사용
        deviceId: selectedMicId ? { exact: selectedMicId } : undefined,

        // 에코 제거
        echoCancellation: { ideal: true },

        // 주변 소음 억제
        noiseSuppression: { ideal: true },

        // 자동 음량 조절
        autoGainControl: { ideal: true },

        // 음성 통화용 1채널 권장
        channelCount: { ideal: 1 },

        // WebRTC 음성 샘플레이트
        sampleRate: { ideal: 48000 },
    }
}

async function applyMicGainToStream(stream) {
    // stream 안에서 오디오 트랙만 꺼냄
    const audioTracks = stream.getAudioTracks()

    // 마이크가 없으면 원래 stream 그대로 반환
    if (audioTracks.length === 0) {
        return stream
    }

    // 기존 video track들은 그대로 유지
    const videoTracks = stream.getVideoTracks()

    // AudioContext 생성
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    audioContext = new AudioContextClass()

    // 브라우저 정책 때문에 멈춰 있으면 다시 실행
    if (audioContext.state === "suspended") {
        await audioContext.resume()
    }

    // 기존 마이크 오디오 트랙을 MediaStream으로 감쌈
    const audioStream = new MediaStream([audioTracks[0]])

    // 오디오 소스 생성
    const source = audioContext.createMediaStreamSource(audioStream)

    // 볼륨 조절 노드 생성
    micGainNode = audioContext.createGain()

    // 현재 range 값으로 마이크 음량 설정
    micGainNode.gain.value = Number(micVolume.value || 1)

    // 최종 출력용 destination 생성
    const destination = audioContext.createMediaStreamDestination()

    // 마이크 소리 → 볼륨 조절 → 출력 스트림
    source.connect(micGainNode)
    micGainNode.connect(destination)

    // 볼륨 조절이 적용된 새 오디오 트랙
    const controlledAudioTrack = destination.stream.getAudioTracks()[0]

    // video track + 조절된 audio track으로 새 stream 생성
    const newStream = new MediaStream([
        ...videoTracks,
        controlledAudioTrack,
    ])

    return newStream
}

// 마이크/스피커 목록 불러오기
async function loadMediaDevices() {
    try {
        // 브라우저에서 사용 가능한 장치 목록 가져오기
        const devices = await navigator.mediaDevices.enumerateDevices()

        // 마이크 목록
        const microphones = devices.filter((device) => device.kind === "audioinput")

        // 스피커 목록
        const speakers = devices.filter((device) => device.kind === "audiooutput")

        // 마이크 select 초기화
        micSelect.innerHTML = `<option value="">기본 마이크</option>`

        microphones.forEach((device, index) => {
            const option = document.createElement("option")
            option.value = device.deviceId
            option.textContent = device.label || `마이크 ${index + 1}`

            if (device.deviceId === selectedMicId) {
                option.selected = true
            }

            micSelect.appendChild(option)
        })

        // 스피커 선택 기능 지원 여부 확인
        if (!("setSinkId" in HTMLMediaElement.prototype)) {
            speakerSelect.innerHTML = `<option value="">스피커 선택 미지원</option>`
            speakerSelect.disabled = true
            return
        }

        // 스피커 select 초기화
        speakerSelect.innerHTML = `<option value="">기본 스피커</option>`

        speakers.forEach((device, index) => {
            const option = document.createElement("option")
            option.value = device.deviceId
            option.textContent = device.label || `스피커 ${index + 1}`

            if (device.deviceId === selectedSpeakerId) {
                option.selected = true
            }

            speakerSelect.appendChild(option)
        })
    } catch (error) {
        console.error("장치 목록 불러오기 실패:", error)
    }
}

function updateRemoteMuteButton() {
    if (isRemoteMuted) {
        remoteMuteIcon.textContent = "🔇"
        remoteMuteBtn.classList.add("is-off")
        remoteMuteBtn.title = "상대방 소리 켜기"
    } else {
        remoteMuteIcon.textContent = "🔊"
        remoteMuteBtn.classList.remove("is-off")
        remoteMuteBtn.title = "상대방 소리 끄기"
    }
}

// 상대방 소리 음소거 상태 변경
function setRemoteMuted(nextMuted) {
    isRemoteMuted = nextMuted

    if (isRemoteMuted) {
        const currentVolume = Number(remoteVolume.value)

        if (currentVolume > 0) {
            lastRemoteVolumeBeforeMute = currentVolume
        }

        remoteVolume.value = 0
        remoteVideo.volume = 0
    } else {
        const restoreVolume = lastRemoteVolumeBeforeMute || 0.5

        remoteVolume.value = restoreVolume
        remoteVideo.volume = restoreVolume
    }

    updateRemoteMuteButton()
}

// 상대방 소리 조절
remoteVolume.addEventListener("input", () => {
    const volume = Number(remoteVolume.value)

    if (!isRemoteMuted && volume > 0) {
        lastRemoteVolumeBeforeMute = volume
    }

    // 소리가 꺼진 상태에서 슬라이더를 올리면 자동으로 켜기
    if (isRemoteMuted && volume > 0) {
        isRemoteMuted = false
        updateRemoteMuteButton()
    }

    remoteVideo.volume = volume
})

// 상대방 소리 끄기/켜기
remoteMuteBtn.addEventListener("click", () => {
    setRemoteMuted(!isRemoteMuted)
})

// 내 마이크 음량 조절
// 마이크 gain 값 변경
function setMicGain(value) {
    const volume = Number(value)

    if (micGainNode) {
        micGainNode.gain.value = volume
    }
}

// 실제 WebRTC로 보내는 마이크 트랙 켜기/끄기
function setMicrophoneTrackEnabled(enabled) {
    // localStream 안의 오디오 트랙 제어
    if (localStream) {
        localStream.getAudioTracks().forEach((track) => {
            track.enabled = enabled
        })
    }

    // peerConnection sender 안의 오디오 트랙도 한 번 더 제어
    // 이걸 같이 해주면 상대방에게 나가는 마이크가 더 확실히 꺼짐
    if (peerConnection) {
        peerConnection.getSenders().forEach((sender) => {
            if (sender.track && sender.track.kind === "audio") {
                sender.track.enabled = enabled
            }
        })
    }
}

// 마이크 버튼 상태를 화면에 반영
function updateMuteButton() {
    if (isMicMuted) {
        muteIcon.textContent = "🎙️"
        muteIcon.classList.add("is-muted")
        muteBtn.classList.add("is-off")
        muteBtn.title = "마이크 켜기"
    } else {
        muteIcon.textContent = "🎙️"
        muteIcon.classList.remove("is-muted")
        muteBtn.classList.remove("is-off")
        muteBtn.title = "마이크 끄기"
    }
}

// 마이크 음소거 상태 변경
function setMicMuted(nextMuted) {
    isMicMuted = nextMuted

    if (isMicMuted) {
        // 끄기 전 음량 저장
        const currentVolume = Number(micVolume.value)

        if (currentVolume > 0) {
            lastMicVolumeBeforeMute = currentVolume
        }

        // 슬라이더를 0으로 내림
        micVolume.value = 0

        // 실제 마이크 소리도 0으로 만듦
        setMicGain(0)

        // WebRTC 오디오 트랙 끄기
        setMicrophoneTrackEnabled(false)
    } else {
        // 저장해둔 음량으로 복구
        const restoreVolume = lastMicVolumeBeforeMute || 1

        micVolume.value = restoreVolume

        // 실제 마이크 소리 복구
        setMicGain(restoreVolume)

        // WebRTC 오디오 트랙 켜기
        setMicrophoneTrackEnabled(true)
    }

    updateMuteButton()
}

// 내 마이크 음량 조절
micVolume.addEventListener("input", () => {
    const volume = Number(micVolume.value)

    // 마이크가 켜져 있을 때만 마지막 음량 저장
    if (!isMicMuted && volume > 0) {
        lastMicVolumeBeforeMute = volume
    }

    // 마이크가 꺼진 상태에서 슬라이더를 올리면 자동으로 마이크 켜기
    if (isMicMuted && volume > 0) {
        isMicMuted = false
        setMicrophoneTrackEnabled(true)
        updateMuteButton()
    }

    setMicGain(volume)
})

// 마이크 끄기/켜기
muteBtn.addEventListener("click", () => {
    if (!localStream) {
        return
    }

    setMicMuted(!isMicMuted)
})

// 스피커 선택
speakerSelect.addEventListener("change", async () => {
    selectedSpeakerId = speakerSelect.value

    try {
        if ("setSinkId" in remoteVideo) {
            await remoteVideo.setSinkId(selectedSpeakerId)
            console.log("스피커 변경:", selectedSpeakerId)
        } else {
            alert("이 브라우저는 스피커 선택을 지원하지 않습니다.")
        }
    } catch (error) {
        console.error("스피커 변경 실패:", error)
        alert("스피커 변경에 실패했습니다.")
    }
})

// 마이크 선택
micSelect.addEventListener("change", async () => {
    selectedMicId = micSelect.value

    // 아직 입장 전이면 선택값만 저장
    if (!localStream) {
        return
    }

    await changeMicrophone()
})

// 마이크를 변경하는 함수
async function changeMicrophone() {
    try {
        // 새 마이크 스트림 가져오기
        let newStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: getAudioConstraints(),
        })

        // 새 마이크에도 볼륨 조절 적용
        newStream = await applyMicGainToStream(newStream)

        const newAudioTrack = newStream.getAudioTracks()[0]

        // 현재 음소거 상태 반영
        newAudioTrack.enabled = !isMicMuted

        // 기존 오디오 트랙 제거
        const oldAudioTrack = localStream.getAudioTracks()[0]

        if (oldAudioTrack) {
            localStream.removeTrack(oldAudioTrack)
            oldAudioTrack.stop()
        }

        // localStream에 새 오디오 트랙 추가
        localStream.addTrack(newAudioTrack)

        // WebRTC 연결 중이면 상대방에게 보내는 트랙도 교체
        if (peerConnection) {
            const sender = peerConnection
                .getSenders()
                .find((sender) => sender.track && sender.track.kind === "audio")

            if (sender) {
                await sender.replaceTrack(newAudioTrack)
            } else {
                peerConnection.addTrack(newAudioTrack, localStream)
            }
        }

        console.log("마이크 변경 완료")
    } catch (error) {
        console.error("마이크 변경 실패:", error)
        alert("마이크 변경에 실패했습니다.")
    }
}

// 현재 어떤 화면이 큰 화면인지 확인하는 함수
function isMainCard(card) {
    const isLocalMain = videoStage.classList.contains("local-main")

    if (isLocalMain) {
        return card === localCard
    }

    return card === remoteCard
}

// 전체화면으로 여는 함수
async function openFullscreen(element) {
    try {
        if (document.fullscreenElement) {
            return
        }

        if (element.requestFullscreen) {
            await element.requestFullscreen()
        }
    } catch (error) {
        console.error("전체화면 전환 실패:", error)
    }
}

// 내 화면 카드 클릭
localCard.addEventListener("click", async () => {
    // 내 화면이 이미 큰 화면이면 전체화면
    if (isMainCard(localCard)) {
        await openFullscreen(localCard)
        return
    }

    // 내 화면을 큰 화면으로 변경
    videoStage.classList.add("local-main")
})

// 상대방 화면 카드 클릭
remoteCard.addEventListener("click", async () => {
    // 상대방 화면이 이미 큰 화면이면 전체화면
    if (isMainCard(remoteCard)) {
        await openFullscreen(remoteCard)
        return
    }

    // 상대방 화면을 큰 화면으로 변경
    videoStage.classList.remove("local-main")
})

// 오디오 설정 패널 열고 닫기
function toggleControlPanel() {
    controlPanel.classList.toggle("is-open")

    const isOpen = controlPanel.classList.contains("is-open")
    controlToggleIcon.textContent = isOpen ? "×" : "🎚️"
    controlToggleBtn.title = isOpen ? "오디오 설정 닫기" : "오디오 설정"
}

// 오디오 설정 버튼 클릭
controlToggleBtn.addEventListener("click", (event) => {
    event.stopPropagation()
    toggleControlPanel()
})

// 닫기 버튼 클릭
controlCloseBtn.addEventListener("click", (event) => {
    event.stopPropagation()
    controlPanel.classList.remove("is-open")
    controlToggleIcon.textContent = "🎚️"
    controlToggleBtn.title = "오디오 설정"
})

// 패널 안을 눌렀을 때 큰 화면 클릭 이벤트로 넘어가지 않게 막기
controlPanel.addEventListener("click", (event) => {
    event.stopPropagation()
})

function getVideoSender() {
    if (!peerConnection) {
        return null
    }

    return peerConnection
        .getSenders()
        .find((sender) => {
            return sender.track && sender.track.kind === "video"
        })
}

async function startScreenShare() {
    if (!peerConnection) {
        alert("먼저 방에 입장하세요.")
        return
    }

    if (isScreenSharing) {
        return
    }

    try {
        const screenStream =
            await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: {
                        ideal: 15,
                        max: 30,
                    },
                },

                audio: false,

                // 지원하는 브라우저에서는 전체 모니터 선택 항목 제외
                monitorTypeSurfaces: "exclude",

                // 현재 화상채팅 탭을 공유 대상으로 표시하지 않음
                selfBrowserSurface: "exclude",
            })

        const newScreenTrack =
            screenStream.getVideoTracks()[0]

        if (!newScreenTrack) {
            throw new Error("화면 공유 트랙이 없습니다.")
        }

        // 실제로 사용자가 무엇을 선택했는지 확인
        const settings = newScreenTrack.getSettings()
        const displaySurface = settings.displaySurface

        console.log("화면 공유 종류:", displaySurface)

        /*
         * monitor = 전체 화면
         * window  = 특정 프로그램 창
         * browser = 특정 브라우저 탭
         */
        if (displaySurface === "monitor") {
            screenStream
                .getTracks()
                .forEach((track) => track.stop())

            alert(
                "전체 화면을 공유하면 같은 모니터에서 " +
                "재귀 현상이 발생합니다.\n\n" +
                "특정 창 또는 브라우저 탭을 선택해 주세요."
            )

            return
        }

        const videoSender = peerConnection
            .getSenders()
            .find((sender) => {
                return sender.track?.kind === "video"
            })

        if (!videoSender) {
            screenStream
                .getTracks()
                .forEach((track) => track.stop())

            throw new Error("영상 전송 정보를 찾지 못했습니다.")
        }

        screenVideoTrack = newScreenTrack

        // 상대방에게 전송하는 영상만 화면 공유로 교체
        await videoSender.replaceTrack(screenVideoTrack)

        isScreenSharing = true

        shareScreenBtn.textContent = "화면 공유 중지"
        shareScreenBtn.classList.add("is-sharing")

        statusText.textContent =
            "화면을 공유하고 있습니다."

        /*
         * 절대 localVideo에 screenStream을 넣지 않음
         * localVideo는 기존 카메라 화면을 계속 표시
         */
        localVideo.srcObject = localStream

        // 브라우저 공유 중지 버튼을 눌렀을 때
        screenVideoTrack.addEventListener(
            "ended",
            async () => {
                if (isScreenSharing) {
                    await stopScreenShare()
                }
            },
            {
                once: true,
            }
        )
    } catch (error) {
        console.error(
            "화면 공유 시작 실패:",
            error
        )

        // 화면 선택창에서 취소한 경우
        if (
            error.name === "NotAllowedError" ||
            errstopor.name === "AbortError"
        ) {
            return
        }

        alert(
            `화면 공유 실패: ${error.message}`
        )
    }
}

async function stopScreenShare() {
    if (!isScreenSharing && !screenVideoTrack) {
        return
    }

    const oldScreenTrack = screenVideoTrack

    isScreenSharing = false
    screenVideoTrack = null

    try {
        const videoSender = peerConnection
            ?.getSenders()
            .find((sender) => {
                return sender.track?.kind === "video"
            })

        // 다시 카메라 영상으로 교체
        const restoreVideoTrack =
            cameraVideoTrack?.readyState === "live"
                ? cameraVideoTrack
                : fallbackVideoTrack

        if (
            videoSender &&
            restoreVideoTrack &&
            restoreVideoTrack.readyState === "live"
        ) {
            await videoSender.replaceTrack(
                restoreVideoTrack
            )
        }

        if (
            oldScreenTrack &&
            oldScreenTrack.readyState === "live"
        ) {
            oldScreenTrack.stop()
        }
    } catch (error) {
        console.error(
            "화면 공유 종료 실패:",
            error
        )
    }

    // 내 미리보기는 계속 카메라
    if (localStream) {
        localVideo.srcObject = localStream
    }

    shareScreenBtn.textContent = "화면 공유"
    shareScreenBtn.classList.remove("is-sharing")

    statusText.textContent =
        "카메라를 공유하고 있습니다."
}

updateMuteButton()
updateRemoteMuteButton()

remoteVideo.volume = Number(remoteVolume.value)