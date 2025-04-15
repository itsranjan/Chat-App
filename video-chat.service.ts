import { inject, Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder } from '@microsoft/signalr';
import { AuthService } from './auth.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class VideoChatService {
  private hubUrl = 'https://localhost:7777/hubs/video';
  private authService = inject(AuthService);
  public offerReceived = new BehaviorSubject<{senderId: string, offer: RTCSessionDescriptionInit} | null>(null);
  public answerReceived = new BehaviorSubject<{senderId: string, answer: RTCSessionDescription} | null>(null);
  public iceCandidateReceived = new BehaviorSubject<{senderId: string, candidate: RTCIceCandidate} | null>(null);

  public incomingCall = false;
  public isCallActive = false;
  public remoteUserId = '';

  public peerConnection!: RTCPeerConnection;

  public hubConnection!: HubConnection;

  startConnection() {
    this.hubConnection = new HubConnectionBuilder()
      .withUrl(this.hubUrl,{
        accessTokenFactory: () => this.authService.getAccessToken!
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .then(() => console.log('Video Call Connection started'))
      .catch((err) => console.log(err));

    this.hubConnection.on('ReceiveOffer', (senderId, offer) => {
      this.offerReceived.next({senderId, offer:JSON.parse(offer)});
    });

    this.hubConnection.on('ReceiveAnswer', (senderId, answer) => {
      this.answerReceived.next({senderId, answer:JSON.parse(answer)});
    });

    this.hubConnection.on('ReceiveIceCandidate', (senderId, candidate) => {
      this.iceCandidateReceived.next({senderId, candidate:JSON.parse(candidate)});
    })
  }

  sendOffer(receiverId: string, offer: RTCSessionDescriptionInit) {
    this.hubConnection.invoke('SendOffer', receiverId, JSON.stringify(offer))
    .catch((err) => console.log(err));
  }

  sendAnswer(receiverId: string, answer: RTCSessionDescriptionInit) {
    this.hubConnection.invoke('SendAnswer', receiverId, JSON.stringify(answer))
    .catch((err) => console.log(err));
  }

  sendIceCandidate(receiverId: string, candidate: RTCIceCandidate) {
    this.hubConnection.invoke('SendIceCandidate', receiverId, JSON.stringify(candidate))
    .catch((err) => console.log(err));
  }

  sendEndCall(receiverId: string) {
    this.hubConnection.invoke('EndCall', receiverId)
    .catch((err) => console.log(err));
  }
}
