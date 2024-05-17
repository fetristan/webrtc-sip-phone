import React, { useEffect, useState, useRef } from 'react';
import {
  UserAgent,
  UserAgentOptions,
  Registerer,
  Inviter,
  Invitation
} from 'sip.js';
import * as CryptoJS from 'crypto-js';
import './App.css';

// Utility function to get the peerConnection
const getPeerConnection = (sessionDescriptionHandler: any) => {
  return sessionDescriptionHandler.peerConnection;
};

// The main component of the app
function App() {
  const getTURNCredentials = (name: string, secret: string, expiry: number): { username: string, password: string } => {
    const unixTimeStamp = Math.floor(Date.now() / 1000) + expiry; // 1 hour expiry
    const username = [unixTimeStamp, name].join(':');
    const password = CryptoJS.HmacSHA1(username, secret).toString(CryptoJS.enc.Base64);
    return { username, password };
  }
  // State hooks to manage the SIP user agent, sessions, call status and action status
  const [userAgent, setUserAgent] = useState<UserAgent | null>(null);
  const [incomingSession, setIncomingSession] = useState<Invitation | null>(null);
  const [outgoingSession, setOutgoingSession] = useState<Inviter | null>(null);
  const [callStatus, setCallStatus] = useState<string>('No call in progress');
  const [actionStatus, setActionStatus] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement>(null); // Reference for audio element

  // SIP server configuration
  const server: string = process.env.REACT_APP_SERVER ?? '';
  const uriString: string = process.env.REACT_APP_URI_STRING ?? '';
  const authorizationPassword: string = process.env.REACT_APP_AUTHORIZATION_PASSWORD ?? '';
  const authorizationUsername: string = process.env.REACT_APP_AUTHORIZATION_USERNAME ?? '';
  const targetUriString: string = process.env.REACT_APP_TARGET_URI_STRING ?? '';
  const turnServer: string = process.env.REACT_APP_TURN_SERVER ?? '';
  const turnServerName: string = process.env.REACT_APP_TURN_SERVER_NAME ?? '';
  const turnAuthSecret: string = process.env.REACT_APP_TURN_AUTH_SECRET ?? '';
  const turnAuthExpiry: number = parseInt(process.env.REACT_APP_TURN_AUTH_EXPIRY ?? '3600');
  const turnCredentials: { username: string, password: string } = getTURNCredentials(turnServerName, turnAuthSecret, turnAuthExpiry);
  const turnUsername: string = turnCredentials.username;
  const turnCredential: string = turnCredentials.password;

  // Effect hook to initialize the SIP User Agent and handle its lifecycle
  useEffect(() => {
    const uri = UserAgent.makeURI(uriString);
    if (!uri) {
      console.error(`Invalid SIP URI: ${uriString}`);
      return;
    }

    // UserAgent configuration options
    const userAgentOptions: UserAgentOptions = {
      authorizationPassword: authorizationPassword,
      authorizationUsername: authorizationUsername,
      sessionDescriptionHandlerFactoryOptions: {
        peerConnectionConfiguration: {
          iceServers: [{
            urls: turnServer,
            username: turnUsername,
            credential: turnCredential
          }],
          iceTransportPolicy: 'all',
          constraints: { audio: true, video: false },
        },
      },
      transportOptions: {
        server
      },
      uri
    };

    // Initializing the UserAgent and registering event listeners
    const ua = new UserAgent(userAgentOptions);
    ua.start().then(() => {
      console.log('User Agent started');
      const registerer = new Registerer(ua);
      // Setting up event listeners for different SIP events
      ua.delegate = {
        onInvite: (invitation: Invitation) => {
          console.log('Incoming call from ', invitation.remoteIdentity.toString());
          setCallStatus(`Incoming call from ${invitation.remoteIdentity.toString()}`);
          setIncomingSession(invitation);
          handleIncomingCall(invitation); // Handle the incoming call
        }
      };
      registerer.register();
    }).catch((error) => console.error('Failed to start User Agent:', error));

    // Cleaning up on component unmount
    setUserAgent(ua);
    return () => {
      ua.stop();
      console.log('User Agent stopped');
    };
  }, []);

  // Function to initiate a call
  const handleIncomingCall = (invitation: Invitation) => {
    const peerConnection = getPeerConnection(invitation.sessionDescriptionHandler);
    peerConnection.ontrack = (event: RTCTrackEvent) => {
      if (audioRef.current) {
        audioRef.current.srcObject = event.streams[0];
        audioRef.current.play();
      }
    };
  };

  const makeCall = (): void => {
    const targetUri = UserAgent.makeURI(targetUriString);
    setActionStatus('Make Outgoing call');
    if (!targetUri) {
      console.error(`Invalid target URI: ${targetUriString}`);
      return;
    }
    if (userAgent) {
      const inviter = new Inviter(userAgent, targetUri);
      inviter.invite().then(() => {
        console.log('Call initiated to', targetUriString);
        setCallStatus(`Outgoing call to ${inviter.remoteIdentity.toString()}`);
        setOutgoingSession(inviter);

        const peerConnection = getPeerConnection(inviter.sessionDescriptionHandler);
        peerConnection.ontrack = (event: RTCTrackEvent) => {
          if (audioRef.current) {
            audioRef.current.srcObject = event.streams[0];
            audioRef.current.play();
          }
        };
      }).catch((error) => console.error('Failed to initiate call:', error));
    }
  };

  // Function to answer an incoming call
  const answerCall = (): void => {
    setActionStatus('Answer call');
    if (incomingSession) {
      incomingSession.accept().then(() => {
        setCallStatus('Call answered');
        console.log('Call answered');

        const peerConnection = getPeerConnection(incomingSession.sessionDescriptionHandler);
        peerConnection.ontrack = (event: RTCTrackEvent) => {
          if (audioRef.current) {
            audioRef.current.srcObject = event.streams[0];
            audioRef.current.play();
          }
        };
      }).catch((error) => console.error('Failed to accept call:', error));
    }
  };

  // Function to hang up an ongoing call
  const hangupCall = (): void => {
    setActionStatus('Hangup or reject call');
    if (incomingSession) {
      incomingSession.reject().then(() => {
        setCallStatus('Incoming call rejected');
        console.log('Incoming call rejected');
      }).catch((error) => console.error('Failed to reject incoming call:', error));
      incomingSession.bye().then(() => {
        setCallStatus('Incoming call hangup');
        console.log('Incoming call hangup');
      }).catch((error) => console.error('Failed to hangup incoming call:', error));
      setIncomingSession(null);
    } else if (outgoingSession) {
      outgoingSession.bye().then(() => {
        setCallStatus('Outgoing call hung up');
        console.log('Outgoing call hung up');
      }).catch((error) => console.error('Failed to hangup outgoing call:', error));
      setOutgoingSession(null);
    } else {
      console.log('No incoming/outgoing call to hangup');
    }
  };

  // Function to send DTMF tones during a call
  const sendDtmf = (dtmf: string): void => {
    setActionStatus(`Send DTMF ${dtmf}`);
    console.log(`Send dtmf ${dtmf}`);
    const options = {
      requestOptions: {
        body: {
          contentDisposition: 'render',
          contentType: 'application/dtmf-relay',
          content: 'Signal=' + dtmf + '\r\nDuration=1'
        }
      }
    };
    if (incomingSession) {
      incomingSession.info(options).then(() => {
        console.log('DTMF sent');
      }).catch((error) => console.error('Failed to send DTMF:', error));
    } else if (outgoingSession) {
      outgoingSession.info(options).then(() => {
        console.log('DTMF sent');
      }).catch((error) => console.error('Failed to send DTMF:', error));
    } else {
      console.log('No incoming/outgoing call to send DTMF');
    }
  };

  // Render function to display the UI components
  return (
    <div className='App'>
      <header className='App-header'>
        <div className='Phone'>
          <div className='Screen'>
            <p className='Screen-Text'>{callStatus}</p>
            <p className='Screen-Text'>{actionStatus}</p>
          </div>
          <div className='Boutons'>
            <button className='Hangup' onClick={hangupCall}>Hangup</button>
            <button onClick={makeCall}>+</button>
            <button className='Answer' onClick={answerCall}>Answer</button>
            <button onClick={() => sendDtmf('1')}>1</button>
            <button onClick={() => sendDtmf('2')}>2</button>
            <button onClick={() => sendDtmf('3')}>3</button>
            <button onClick={() => sendDtmf('4')}>4</button>
            <button onClick={() => sendDtmf('5')}>5</button>
            <button onClick={() => sendDtmf('6')}>6</button>
            <button onClick={() => sendDtmf('7')}>7</button>
            <button onClick={() => sendDtmf('8')}>8</button>
            <button onClick={() => sendDtmf('9')}>9</button>
            <button onClick={() => sendDtmf('*')}>*</button>
            <button onClick={() => sendDtmf('0')}>0</button>
            <button onClick={() => sendDtmf('#')}>#</button>
          </div>
        </div>
        <audio id="audio" ref={audioRef}></audio>
      </header>
    </div>
  );
}

export default App;
