import React, {
  useEffect,
  useState
} from 'react';
import {
  UserAgent,
  UserAgentOptions,
  Registerer,
  Inviter,
  Invitation
} from 'sip.js';
import './App.css';

// The main component of the app
function App() {

  // State hooks to manage the SIP user agent, sessions, call status and action status
  const [userAgent, setUserAgent] = useState<UserAgent | null>(null);
  const [incomingSession, setIncomingSession] = useState<Invitation | null>(null);
  const [outgoingSession, setOutgoingSession] = useState<Inviter | null>(null);
  const [callStatus, setCallStatus] = useState<string>('No call in progress');
  const [actionStatus, setActionStatus] = useState<string>('');

  // SIP server configuration
  const server: string = process.env.REACT_APP_SERVER ?? '';
  const uriString: string = process.env.REACT_APP_URI_STRING ?? '';
  const authorizationPassword = process.env.REACT_APP_AUTHORIZATION_PASSWORD ?? '';
  const authorizationUsername = process.env.REACT_APP_AUTHORIZATION_USERNAME ?? '';
  const targetUriString = process.env.REACT_APP_TARGET_URI_STRING ?? '';

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
      transportOptions: {
        server
      },
      uri
    };

    // Initializing the UserAgent and registering event listeners
    const ua  = new UserAgent(userAgentOptions);
    ua.start().then(() => {
      console.log('User Agent started');
      const registerer = new Registerer(ua);
      // Setting up event listeners for different SIP events
      ua.delegate = {
        onInvite: (invitation: Invitation) => {
          console.log('Incoming call from ', invitation.remoteIdentity.toString());
          setCallStatus(`Incoming call from ${invitation.remoteIdentity.toString()}`);
          setIncomingSession(invitation);
        },
        onConnect: () => {
          console.log('Call connected');
          setCallStatus('Call connected');
        },
        onDisconnect: () => {
          console.log('Call disconnected');
          setCallStatus('Call disconnected');
        },
        onRegister: () => {
          console.log('Registered');
          setCallStatus('Call disconnected');
        },onMessage: (message) => {
          console.log('Message received', message);
          setCallStatus(`Message received ${message}`);
        },onNotify: (notification) => {
          console.log('Notification received', notification);
          setCallStatus(`Notification received ${notification}`);
        },onRefer: (referral) => {
          console.log('Referral received', referral);
          setCallStatus(`Referral received ${referral}`);
        },onReferRequest: (referral) => {
          console.log('Referral request received', referral);
          setCallStatus(`Referral request received ${referral}`);
        },onRegisterRequest: (registration) => {
          console.log('Registration request received', registration);
          setCallStatus(`Registration request received ${registration}`);
        },onSubscribe: (subscription) => {
          console.log('Subscription received', subscription);
          setCallStatus(`Subscription received ${subscription}`);
        },onSubscribeRequest: (subscription) => {
          console.log('Subscription request received', subscription);
          setCallStatus(`Subscription request received ${subscription}`);
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
  }, [uriString, authorizationPassword, authorizationUsername, server]);

  // Function to initiate a call
  const makeCall = (): void => {
    const targetUri = UserAgent.makeURI(targetUriString);
    setActionStatus(`Make Outgoing call`);
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
      }).catch((error) => console.error('Failed to initiate call:', error));
    }
  };

  // Function to answer an incoming call
  const answerCall = (): void => {
    setActionStatus(`Answer call`);
    incomingSession?.accept().then(() => {
      setCallStatus('Call answered');
      console.log('Call answered');
    }).catch((error) => console.error('Failed to accept call:', error));
  };

  // Function to hang up an ongoing call
  const hangupCall = (): void => {
    setActionStatus(`Hangup or reject call`);
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
    }
    else if (outgoingSession) {
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
  const sendDtmf = (dtmf : string): void => {
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
    }
    else if (outgoingSession) {
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
        <p>
        <div className='Phone'>
          <div className='Screen'><p className='Screen-Text'>{callStatus}</p><p className='Screen-Text'>{actionStatus}</p></div>
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
        </p>
      </header>
    </div>
  );
}

export default App;
