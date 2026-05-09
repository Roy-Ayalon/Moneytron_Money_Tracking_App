import React from 'react';
import { Lightbulb, Mail } from 'lucide-react';
import { getCookie } from '../utils.js';

export default function FeedbackButton(){
  const [showModal, setShowModal] = React.useState(false);
  const [feedbackText, setFeedbackText] = React.useState('');
  const [feedbackName, setFeedbackName] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [resultMsg, setResultMsg] = React.useState('');

  function sendFeedback(){
    if(!feedbackText.trim()) return;
    setSending(true);
    setResultMsg('');
    const name = feedbackName.trim() || 'Anonymous';
    fetch('/api/feedback', {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/json', 'X-CSRF-Token': getCookie('mt_csrf') || ''},
      body: JSON.stringify({name: name, message: feedbackText})
    })
    .then(r => r.json())
    .then(data => {
      setSending(false);
      if (data.ok) {
        setSent(true);
        if (data.email_sent) {
          setResultMsg('Your feedback has been saved and emailed to the developer. Thank you!');
        } else if (!data.has_email) {
          setResultMsg('Your feedback has been saved! To enable email delivery, add your email in Sign Up.');
        } else {
          setResultMsg('Your feedback has been saved! Email delivery will be attempted when SMTP is configured.');
        }
        setTimeout(()=>{ setShowModal(false); setSent(false); setFeedbackText(''); setFeedbackName(''); setResultMsg(''); }, 3000);
      } else {
        setResultMsg('Failed to save feedback. Please try again.');
      }
    })
    .catch(err => {
      setSending(false);
      setResultMsg('Error: ' + err.message);
    });
  }

  return (
    <React.Fragment>
      <button className="feedback-fab" onClick={()=>setShowModal(true)} title="Send improvement ideas">
        <Lightbulb size={16}/>Send Idea
      </button>
      {showModal && (
        <div className="modal-overlay" onClick={()=>{setShowModal(false);setSent(false);}}>
          <div className="feedback-modal-card" onClick={e=>e.stopPropagation()}>
            {sent ? (
              <div style={{textAlign:'center',padding:'30px 0'}}>
                <div style={{fontSize:56,marginBottom:12}}>✅</div>
                <h3 style={{textAlign:'center'}}>Thank You!</h3>
                <p style={{color:'#667085',marginTop:8}}>{resultMsg}</p>
              </div>
            ) : (
              <React.Fragment>
                <h3><Lightbulb size={20}/>Share Your Improvement Idea</h3>
                <p style={{color:'#667085',fontSize:14,margin:'6px 0 18px'}}>Help us make MoneyTron better! Your ideas are saved and sent to the developer.</p>
                <label style={{display:'block',fontWeight:700,fontSize:14,color:'#30334b',marginBottom:6}}>Your Name (optional)</label>
                <input type="text" placeholder="Your name" value={feedbackName} onChange={e=>setFeedbackName(e.target.value)} style={{marginBottom:14}} />
                <label style={{display:'block',fontWeight:700,fontSize:14,color:'#30334b',marginBottom:6}}>Your Idea / Suggestion</label>
                <textarea placeholder="What feature would you like to see? What could be improved? Any bugs to report?" value={feedbackText} onChange={e=>setFeedbackText(e.target.value)}/>
                <div style={{display:'flex',alignItems:'center',gap:8,marginTop:8}}>
                  <span style={{fontSize:12,color:'#667085',display:'inline-flex',alignItems:'center',gap:4}}><Mail size={12}/>Sent to: roy1.ayalon@gmail.com</span>
                </div>
                {resultMsg && <div style={{color:'#dc2626',fontSize:13,marginTop:6,fontWeight:600}}>{resultMsg}</div>}
                <div className="modal-actions">
                  <button className="btn" onClick={()=>{setShowModal(false);setSent(false);setResultMsg('');}}>Cancel</button>
                  <button className="btn primary" onClick={sendFeedback} disabled={!feedbackText.trim() || sending}>{sending ? '⏳ Sending...' : 'Send Feedback'}</button>
                </div>
              </React.Fragment>
            )}
          </div>
        </div>
      )}
    </React.Fragment>
  );
}
