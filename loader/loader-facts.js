/* ================================================================
   loader-facts.js — biomedical engineering facts shown by the loader.

   Edit freely: each fact needs a unique `id`, a short category word
   (`cat`, shown in small capitals above it) and plain `text`. Keep the
   wording factual — no statistics that are not well established.
   A visitor sees them in a shuffled order without repeats until all
   have been shown (see loader.js → pickFact).
   ================================================================ */
window.EMBS_LOADER_FACTS = [
  { id: 1,  cat: 'Biosignals', text: 'An ECG records the heart’s electrical activity from the surface of the skin. The signals are tiny — around a thousandth of a volt.' },
  { id: 2,  cat: 'Physiological monitoring', text: 'Pulse oximeters estimate blood oxygen by comparing how red and infrared light are absorbed by oxygen-rich and oxygen-poor haemoglobin.' },
  { id: 3,  cat: 'Wearables', text: 'The light-based sensor on many smartwatches, photoplethysmography, detects the small change in blood volume that each heartbeat pushes through the skin.' },
  { id: 4,  cat: 'Cardiac engineering', text: 'Every heartbeat begins at the sinoatrial node, the heart’s natural pacemaker. Implanted pacemakers take over when that electrical pathway fails.' },
  { id: 5,  cat: 'Cardiac engineering', text: 'A defibrillator delivers a controlled shock that resets heart muscle all at once, giving the heart’s natural rhythm a chance to restart.' },
  { id: 6,  cat: 'Neural engineering', text: 'Cochlear implants bypass damaged hair cells in the inner ear and stimulate the auditory nerve directly with electrical pulses.' },
  { id: 7,  cat: 'Neural engineering', text: 'Brain–computer interfaces decode activity recorded by electrodes to let people control a cursor or a robotic arm with their thoughts.' },
  { id: 8,  cat: 'Neural engineering', text: 'Deep brain stimulation sends electrical pulses to specific brain regions and is used to reduce the tremor of Parkinson’s disease.' },
  { id: 9,  cat: 'Medical imaging', text: 'MRI builds images from signals given off by hydrogen nuclei in a strong magnetic field, without using ionising radiation.' },
  { id: 10, cat: 'Medical imaging', text: 'A CT scanner reconstructs cross-sections of the body by combining X-ray measurements taken from many angles around it.' },
  { id: 11, cat: 'Medical imaging', text: 'Ultrasound imaging works by timing the echoes of high-frequency sound as it reflects off boundaries between tissues.' },
  { id: 12, cat: 'Prosthetics', text: 'Myoelectric prosthetic hands are controlled by the electrical signals of muscles in the residual limb, picked up by electrodes on the skin.' },
  { id: 13, cat: 'Rehabilitation engineering', text: 'Powered exoskeletons assist the hip and knee joints, helping people relearn to walk after spinal cord injury or stroke.' },
  { id: 14, cat: 'Biomechanics', text: 'Gait analysis uses motion capture and force plates to measure exactly how a person walks, guiding surgery and rehabilitation decisions.' },
  { id: 15, cat: 'Medical robotics', text: 'Surgical robots can scale down a surgeon’s hand movements and filter out natural tremor, enabling precise work through small incisions.' },
  { id: 16, cat: 'Signal processing', text: 'Before biosignals can be analysed, engineers filter out interference from mains electricity — 50 Hz in India, 60 Hz in some other countries.' },
  { id: 17, cat: 'Signal processing', text: 'Heart rate variability, the subtle beat-to-beat change in timing, is used as a window into the autonomic nervous system.' },
  { id: 18, cat: 'Biomaterials', text: 'Implants are often coated with hydroxyapatite, the mineral found in bone, so that living bone can bond directly to them.' },
  { id: 19, cat: 'Biomaterials', text: 'Replacement heart valves are either mechanical, often made of pyrolytic carbon, or biological, made from treated animal tissue.' },
  { id: 20, cat: 'Tissue engineering', text: 'Tissue engineering combines cells, scaffolds and chemical signals to grow living tissue. Engineered skin substitutes are already used to treat burns.' },
  { id: 21, cat: 'Instrumentation', text: 'During open-heart surgery, a heart–lung machine temporarily takes over pumping and oxygenating the patient’s blood.' },
  { id: 22, cat: 'Healthcare IoT', text: 'Continuous glucose monitors use a tiny sensor under the skin to measure glucose in tissue fluid every few minutes and send readings wirelessly.' }
];
