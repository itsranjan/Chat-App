import {
  Component,
  ElementRef,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { VideoChatService } from '../services/video-chat.service';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-video-chat',
  imports: [MatIconModule],
  templateUrl: './video-chat.component.html',
  styleUrl: './video-chat.component.css',
})
export class VideoChatComponent implements OnInit {
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;

  private peerConnection!: RTCPeerConnection;
  videoService = inject(VideoChatService);
  private dialogRef: MatDialogRef<VideoChatComponent> = inject(MatDialogRef);
  
  ngOnInit() {
    this.setupPeerConnection();
    this.startLocalVideo();
    this.videoService.startConnection();
    this.setupSignalListerners();
  }

  setupSignalListerners() {
    this.videoService.hubConnection.on('CallEnded', () => {
      this.endCall();
    });

    this.videoService.answerReceived.subscribe(async (data) => {
      if (data) {
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
      }
    });

    this.videoService.iceCandidateReceived.subscribe(async (data) => {
      if (data) {
        await this.peerConnection.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      }
    });
  }

  declineCall() {
    this.videoService.incomingCall = false;
    this.videoService.isCallActive = false;
    this.videoService.sendEndCall(this.videoService.remoteUserId);
    this.dialogRef.close();
  }

  async acceptCall() {
    this.videoService.incomingCall = false;
    this.videoService.isCallActive = true;

    let offer = this.videoService.offerReceived.getValue()?.offer;

    if (offer) {
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      let answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.videoService.sendAnswer(this.videoService.remoteUserId, answer);
    }
  }

  async startCall() {
    this.videoService.isCallActive = true;
    let offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.videoService.sendOffer(this.videoService.remoteUserId, offer);
  }

  setupPeerConnection() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: 'stun:stun.services.mozilla.com',
        },
      ],
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.videoService.sendIceCandidate(
          this.videoService.remoteUserId,
          event.candidate
        );
      }
    };

    this.peerConnection.ontrack = (event) => {
      this.remoteVideo.nativeElement.srcObject = event.streams[0];
    };
  }

  async startLocalVideo() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    this.localVideo.nativeElement.srcObject = stream;
    stream
      .getTracks()
      .forEach((track) => this.peerConnection.addTrack(track, stream));
  }

  async endCall() {
    this.videoService.sendEndCall(this.videoService.remoteUserId);

    if (this.peerConnection) {
      this.dialogRef.close();
      this.videoService.isCallActive = false;
      this.videoService.incomingCall = false;
      this.videoService.remoteUserId = '';
      this.peerConnection.close();
      this.peerConnection = new RTCPeerConnection();
      this.localVideo.nativeElement.srcObject = null;
    }
    const stream = this.localVideo.nativeElement.srcObject as MediaStream;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream.getAudioTracks().forEach((track) => track.stop());
      this.localVideo.nativeElement.srcObject = null;
    }
  }
}
