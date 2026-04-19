# Firestore Schema in Firebase Console Format (Simple Public Room)

This schema matches your exact app goal:

- Anyone who enters can chat in one shared room
- No secure/private messaging requirements
- Keep it simple
- Show who is currently in the room (online)
- Mark users offline when they leave the room
- Keep online/offline visibility for users who interacted before

This is written in Firebase Console add-document style:

- Document parent path
- Document ID
- Field name
- Type
- Value example

## 1) What is FCM Tokens?

FCM token means Firebase Cloud Messaging device token.

You only need this if you plan to send push notifications.

For your current simple room chat:

- You can skip fcmTokens completely.

## 2) rooms Collection (Single Room)

Create one room document.

Document parent path:

/rooms

Document ID:

global

Fields to add:

1. name
- Type: string
- Value: "Global Room"

2. description
- Type: string
- Value: "Public chat room"

3. createdAt
- Type: timestamp
- Value: current server time

4. updatedAt
- Type: timestamp
- Value: current server time

5. lastMessage
- Type: string
- Value: "Welcome"

6. lastMessageAt
- Type: timestamp
- Value: current server time

7. lastMessageSender
- Type: string
- Value: "system"

8. activeCount
- Type: number
- Value: 0

## 3) messages Subcollection (Inside Single Room)

Document parent path:

/rooms/global/messages

Document ID:

Auto-ID

Fields to add:

1. senderName
- Type: string
- Value: "aki"

2. text
- Type: string
- Value: "hello everyone"

3. createdAt
- Type: timestamp
- Value: current server time

4. type
- Type: string
- Value: "text"

5. senderId
- Type: string
- Value: "optional-uid-or-anon-id"

6. senderOnline
- Type: boolean
- Value: true

7. senderLastSeenAt
- Type: timestamp
- Value: current server time

## 4) users Collection (Required for Online/Offline)

For your behavior, this collection should be used (not optional).

Document parent path:

/users

Document ID:

uid or random generated user id

Fields to add:

1. username
- Type: string
- Value: "aki"

2. createdAt
- Type: timestamp
- Value: current server time

3. lastSeenAt
- Type: timestamp
- Value: current server time

4. isOnline
- Type: boolean
- Value: true

5. inRoom
- Type: boolean
- Value: true

6. roomId
- Type: string
- Value: "global"

7. chattedWith
- Type: array
- Value: ["uid_002", "uid_099"]

8. updatedAt
- Type: timestamp
- Value: current server time

## 5) presence Collection (Required for Live Member Status)

Use this for fast live online/offline and typing updates.

Document parent path:

/presence

Document ID:

uid or same random user id

Fields to add:

1. isOnline
- Type: boolean
- Value: true

2. typing
- Type: boolean
- Value: false

3. updatedAt
- Type: timestamp
- Value: current server time

4. roomId
- Type: string
- Value: "global"

5. inRoom
- Type: boolean
- Value: true

6. username
- Type: string
- Value: "aki"

7. lastSeenAt
- Type: timestamp
- Value: current server time

## 6) roomMembers Subcollection (Who Exists in Space Now)

This is the live list of people currently in the room.

Document parent path:

/rooms/global/members

Document ID:

uid

Fields to add:

1. username
- Type: string
- Value: "aki"

2. joinedAt
- Type: timestamp
- Value: current server time

3. isOnline
- Type: boolean
- Value: true

4. lastSeenAt
- Type: timestamp
- Value: current server time

5. chattedWith
- Type: array
- Value: ["uid_002", "uid_099"]

## 7) Minimum You Need to Start Immediately

If you want the absolute minimum schema, only create:

1. /rooms/global
- name (string)
- createdAt (timestamp)

2. /rooms/global/messages/{autoId}
- senderName (string)
- text (string)
- createdAt (timestamp)

3. /rooms/global/members/{uid}
- username (string)
- isOnline (boolean)
- joinedAt (timestamp)

4. /presence/{uid}
- isOnline (boolean)
- inRoom (boolean)
- updatedAt (timestamp)

## 8) Online/Offline Behavior Mapping

1. On join room
- Upsert /users/{uid}: isOnline=true, inRoom=true, roomId="global", updatedAt=now
- Upsert /presence/{uid}: isOnline=true, inRoom=true, roomId="global", updatedAt=now
- Upsert /rooms/global/members/{uid}: isOnline=true, joinedAt=now, lastSeenAt=now
- Increment /rooms/global.activeCount

2. While active
- Update /presence/{uid}.updatedAt and /users/{uid}.lastSeenAt
- If user sends message to or mentions someone, update chattedWith arrays for both users

3. On leave room / disconnect
- Update /users/{uid}: isOnline=false, inRoom=false, lastSeenAt=now, updatedAt=now
- Update /presence/{uid}: isOnline=false, inRoom=false, lastSeenAt=now, updatedAt=now
- Update /rooms/global/members/{uid}: isOnline=false, lastSeenAt=now
- Decrement /rooms/global.activeCount

4. Show offline/online for people chatted with
- Read /users/{uid}.chattedWith
- For each id in chattedWith, read /presence/{otherUid}.isOnline (or /users/{otherUid}.isOnline)
- Render their status badge in UI

## 9) Indexes

1. /rooms/global/messages
- createdAt ascending (usually auto)

2. /rooms
- lastMessageAt descending (if room list grows)

3. /rooms/global/members
- isOnline descending
- joinedAt descending

4. /users
- username ascending

## 10) Notes

1. For timestamp fields, use current date/time in console.
2. In code, prefer serverTimestamp() so ordering is reliable.
3. Since this is a public/simple room, keep rules basic first, then tighten later if needed.
4. If you do not need push notifications now, do not add fcmTokens.

## 11) Temporary Rules for This No-Auth Setup

Because the current app uses username-only join (no Firebase Auth yet), use this temporary rule set so reads/writes work.

```rules
rules_version = '2';
service cloud.firestore {
	match /databases/{database}/documents {
		match /rooms/{roomId} {
			allow read, write: if true;
			match /messages/{messageId} {
				allow read, write: if true;
			}
			match /members/{memberId} {
				allow read, write: if true;
			}
		}

		match /presence/{presenceId} {
			allow read, write: if true;
		}

		match /users/{userId} {
			allow read, write: if true;
		}
	}
}
```

Move to authenticated rules later when you add Firebase Auth.
