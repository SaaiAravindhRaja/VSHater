# VSHater

A VS Code extension that locks your files and forces you to do memes poses on webcam to unlock them.

## What is this

You open a file. It gets encrypted. Now you can't code until you dab, do the Khaby Lame hands, or point at your jawline like you're mewing. You have 60 seconds. Fail and the file gets deleted.

## Why

We were bored and thought it'd be funny to make devs do meme actions just to access their own code.

The idea started as a joke - "what if VS Code hated you?" - and we just kept going.

## Poses you'll have to do

- **67 Hands** - Wave both hands up and down like you're at a concert
- **Fanum Tax** - Stick out your tongue and shake your head
- **Monkey Think** - Put your finger on your lip like you're pondering life
- **Khaby Lame** - The classic palms-up "it's that simple" shrug
- **Mewing** - Point at your jawline
- **Monkey Happy** - Smile and point upward
- **Dab** - You know what a dab is

3 random poses per challenge. 60 seconds total. Good luck.

## How it works

1. You open any file in VS Code
2. Extension encrypts the file content immediately
3. Browser opens with webcam challenge
4. MediaPipe tracks your body and face in real-time
5. Match 3 poses before time runs out
6. Success = file decrypted, VS Code reopens
7. Failure = file deleted, you're cooked

## Tech stack

- **VS Code Extension API** - hooks into file open events, handles encryption/decryption
- **MediaPipe Pose + FaceMesh** - real-time body and face landmark detection in browser
- **Local HTTP server** - serves the challenge page, communicates completion back to extension
- **TypeScript** - because we're not animals

## Building it

```bash
npm install
npm run compile
```

Then press F5 in VS Code to run the extension in debug mode.

## The detection logic

Each pose has specific requirements checked against MediaPipe landmarks:

- Wrist positions relative to shoulders/torso
- Elbow angles (bent vs extended)
- Finger proximity to face landmarks (jawline, lips, nose)
- Mouth shape for smiles
- Motion patterns for waving/shaking
- Head tilt angles

We kept tweaking thresholds until the poses felt doable but not too easy.

## Disclaimer

Don't actually use this on important files. We're not responsible for your deleted code. This is a joke that went too far.
