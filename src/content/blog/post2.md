---
title: "Let's Build Our Own Mesh VPN"
description: "Most explanations of mesh VPNs start with a product and work backwards. You read about magic DNS, ACL tags, exit nodes, subnet routers, and somewhere in the middle you lose the thread of *why any of this exists*."
draft: true
pubDate: "Aug 23 2026"
heroImage: "../../assets/images/mesh_vpn.png"
badge: "New post"
tags: ["mesh", "vpn", "wireguard"]
---


# Let's Build Our Own Mesh VPN
 
*Or: how to derive Tailscale from first principles, so you never have to memorize it.*
 
Most explanations of mesh VPNs start with a product and work backwards. You read about magic DNS, ACL tags, exit nodes, subnet routers, and somewhere in the middle you lose the thread of *why any of this exists*.
 
Let's do the opposite. We'll start with a problem so simple it sounds trivial, and keep fixing whatever breaks. By the end we'll have designed a mesh VPN, and every real product in the space will look like an obvious consequence rather than a pile of features.
 
---
 
## The problem
 
Alice has a laptop in a café. Bob has a desktop at home. Alice wants to send Bob a message directly — no cloud service in between.
 
This should be the easiest thing in the world. It is not.
 
Both machines sit behind NAT. Alice's laptop knows itself as `10.0.0.5`; Bob's PC thinks it's `192.168.1.7`. Neither address means anything outside its own house. When Alice sends a packet toward Bob's router, that router examines it and reasons, roughly: *nobody here asked for this*. Drop.
 
NAT is not malice. It's the workaround the industry adopted when IPv4 addresses ran out, and it works beautifully as long as connections are initiated from the inside. The moment you want *inbound*, you're fighting the design.
 
So let's write down what we actually want:
 
- **Any device to any device** — home, café Wi-Fi, LTE, a VM in a datacenter. Location must not matter.
- **Secure by default** — encrypted and authenticated, because everything in between is hostile.
- **No manual plumbing** — no port forwarding, no static IPs, no calls to your ISP.
That's a VPN. Let's pretend we don't know the word yet and earn it instead.
 
---
 
## Attempt #1: put someone in the middle
 
The first idea everyone has is a machine that *does* have a public IP. Call it Carl — a cheap VPS somewhere.
 
Alice connects *out* to Carl. Bob connects *out* to Carl. Outbound always works, so both connections succeed, and Carl forwards packets between them.
 
This is not a strawman. This is the classic VPN that most people use every day: hub-and-spoke, a concentrator in the middle, everyone dialing in.
 
It also has three problems.
 
**Physics.** If Alice and Bob are in the same room, their packets still fly to Frankfurt and back. Every byte traverses Carl twice, and Carl pays for all of it.
 
**Fragility.** Carl reboots, the network dies. Carl is also a single, well-labelled point of attack.
 
**Trust.** Carl sees who talks to whom, when, and how much. If he's compromised, possibly more.
 
The trust problem is partly solvable: if Alice and Bob exchange public keys and encrypt end-to-end, Carl becomes a blind courier shuffling ciphertext. That's a genuine improvement, and any serious design does it.
 
But notice what didn't change. The latency is still there. The bill is still there. The single point of failure is still there. Encryption fixed the trust problem, not the physics.
 
Which raises the question that drives everything else:
 
> **What if Carl only *introduced* Alice and Bob — and then got out of the way?**
 
---
 
## Going direct
 
### The trick: NAT hole punching
 
A NAT blocks incoming packets, but it lets *replies* through — otherwise nothing on the internet would work. When you send a packet out, your router writes down a small note: *I sent something to that address; traffic coming back from there is expected.*
 
So here's the trick. If Alice and Bob both fire packets at each other at roughly the same moment, each router sees an incoming packet arrive immediately after it sent one out, and concludes it's a reply. Both NATs open a hole. Now there's a direct path, and no middleman on it.
 
It's a beautiful hack precisely because it's so dumb. There's no negotiation, no protocol handshake with the router, no UPnP. Just two sides shouting simultaneously and letting the routers draw the wrong conclusion.
 
### The missing piece: knowing where to shout
 
There's a catch. Alice doesn't know her own public address. Her laptop only sees `10.0.0.5` — the address the world sees is invented by her router, on the fly.
 
Enter **STUN** (Session Traversal Utilities for NAT), which is the simplest server in this entire story. You send it a UDP packet. Your NAT rewrites the source address on the way out. STUN looks at where the packet *actually* came from and tells you: *from where I'm standing, you look like `203.0.113.7:31337`.*
 
That's it. That's the whole protocol.
 
Now a **coordination server** can do the introduction: it collects each peer's public key and observed endpoint, and hands them to the other side. Both peers start punching. Traffic flows directly.
 
The important part is what the coordination server *doesn't* do. It never carries your data. It handles introductions and keys — a few kilobytes — and then it's out of the loop. This split has a name worth internalizing:
 
- **Control plane** — identity, keys, discovery, policy. Centralized.
- **Data plane** — your actual traffic. Direct, peer to peer.
Nearly every design decision in this space follows from keeping those two apart.
 
### When punching fails
 
Honest engineering: hole punching is probabilistic, not guaranteed. Roughly 10–15% of peer pairs can't establish a direct path. Three culprits:
 
**Symmetric NAT.** A normal home router assigns an external port per internal socket — the address STUN reported works for everybody. A symmetric NAT assigns a port per *destination*: STUN sees you as `:31337`, but the same socket appears to Bob as `:48812`. The address you gave him simply doesn't exist. Implementations sometimes guess at port ranges; it works about half the time. Common in corporate networks and some mobile carriers.
 
**Strict firewalls.** Not a NAT problem at all, but a policy one. Plenty of corporate networks block outbound UDP entirely, allowing only DNS and 443. WireGuard is UDP-only, so in such a network it's simply silent.
 
**CGNAT (Carrier-Grade NAT).** Your ISP has run out of IPv4 addresses and puts thousands of subscribers behind one public IP. The tell is that your router got something in `100.64.0.0/10` instead of a public address. Port forwarding is not *difficult* here — it's impossible, because the NAT you'd need to configure belongs to your ISP. Hole punching often still works, since most CGNAT behaves like an ordinary cone NAT, but stack it under your own router and the odds drop.
 
For the unlucky minority, we need a fallback: a **relay**. Which is Carl again — but note the demotion. He's a plan B for a small fraction of pairs, he forwards ciphertext he can't read, and everyone else goes direct.
 
### The data plane: WireGuard
 
We still need something to actually carry the encrypted bytes, and WireGuard has become the default answer.
 
| | WireGuard | OpenVPN | IPsec / IKEv2 |
|---|---|---|---|
| Code size | ~4k lines | ~70k + OpenSSL | ~400k (strongSwan) |
| Crypto | one fixed modern suite | negotiated (TLS) | negotiated (IKE) |
| Handshake | 1-RTT, milliseconds | multi-RTT TLS | 1–2 RTT |
| Speed | in-kernel, fastest | userspace, slower | in-kernel, fast |
| Roaming | built in | reconnect | MOBIKE (if configured) |
| Config | ~8 lines | certs, CA, dozens of options | notoriously painful |
| Transport | UDP only | UDP or TCP/443 | UDP (ESP/4500) |
 
The row that matters most is **crypto**. OpenVPN and IPsec negotiate their cipher suites, which sounds like flexibility and is actually a liability: downgrade attacks, and a thousand ways to configure yourself into insecurity. WireGuard offers exactly one modern suite — ChaCha20-Poly1305, Curve25519, BLAKE2s — take it or leave it. If a primitive falls, the answer is a new protocol version, not a new config option.
 
Two more properties earn their keep here. It runs over **UDP**, which is exactly what hole punching needs. And it **roams**: walk out of the café onto LTE and the tunnel follows you, because a peer is identified by its key, not its address.
 
It's also worth being fair about what WireGuard deliberately does *not* do: no key distribution, no user management, no TCP fallback. In a hotel network that blocks UDP, OpenVPN on TCP/443 gets through and plain WireGuard doesn't.
 
That missing functionality isn't an oversight — it's scope discipline. And it is precisely the gap the control plane fills.
 
---
 
## The mesh
 
Put the pieces together: a control plane handling keys and discovery, and a data plane where every pair connects directly over WireGuard, with a relay only where punching failed.
 
That's a mesh VPN. Not a mysterious product category — this picture.
 
### The N² problem
 
Two nodes is easy. Thirty nodes is `n(n−1)/2` = **435 tunnels**, which in practice means 30 config files with 29 `[Peer]` blocks each — 870 entries maintained by hand. Nobody is doing that.
 
So the control plane's real job comes into focus: push keys, addresses and endpoints to every node automatically, and when a new laptop joins, make sure everyone learns about it within seconds.
 
Notice this is also the business model. The data plane is commodity open source. The managed control plane is the product.
 
### Identity and policy
 
Once membership is automated, the real question is who's allowed in.
 
A device should join by **proving identity** — a key plus an SSO login — not by knowing a shared secret that leaked two years ago. And not every peer should reach every peer: my laptop to the production database, maybe; an intern's phone to the production database, no.
 
This is where mesh VPNs genuinely beat "classic VPN plus firewall rules". Policy attaches to identity rather than to IP addresses, so it survives people changing networks, devices, and continents. And when a phone is lost, you revoke one key instead of rebuilding the network.
 
A mesh without policy is just a flat network with better latency — one compromised node and everything is reachable.
 
### "What if half the network is malicious?"
 
A fair question, and the answer is instructive because it depends entirely on the trust model.
 
In a private mesh: not a problem. Membership is closed. You invited every node, so an attacker can't materialize five hundred sock puppets — they'd have to be admitted first.
 
In *open* peer-to-peer networks — Tor, DHTs, blockchains — anyone can join by design, and spawning fake identities is exactly the attack. It's called a **Sybil attack**, and defending against it is an entire research field. Tor, for instance, needs directory authorities to sign the list of relays, plus long-lived guard nodes, specifically so an adversary can't cheaply end up on both ends of your circuit.
 
Same diagram, different threat model, completely different answer. Decide the trust model first; the topology follows.
 
---
 
## Now the tools explain themselves
 
| Tool | Control plane | Relay fallback | Self-host? |
|---|---|---|---|
| **Tailscale** | SaaS + SSO | DERP | data plane only |
| **Headscale** | open-source Tailscale server | DERP | yes — fully |
| **Nebula** | your own CA + lighthouses | lighthouse relay | yes — DIY spirit |
| **NetBird** | open source, SSO built in | TURN | yes |
| **ZeroTier** | SaaS or self-hosted | own relays | yes |
 
Every row is the same architecture we just derived. The differences are: **who runs the control plane**, and **how identity is established**.
 
One term worth decoding, since it appears everywhere in Tailscale's docs: **DERP** (Detoured Encrypted Routing Protocol) is their relay network. It differs from classic TURN in two useful ways. It speaks HTTPS on 443, so it survives firewalls that kill UDP. And it's addressed by public key — it forwards already-encrypted WireGuard packets to whoever holds a given key, without terminating anything. It's also not purely a fallback: the first packet to an unknown peer always goes via DERP while hole punching runs in parallel, and the connection upgrades to direct mid-stream without a reconnect.
 
---
 
## Where this actually gets used
 
**Distributed teams.** The obvious one, but the interesting part isn't "remote access" — it's that the perimeter stops existing. Two colleagues in the same coworking space talk over the local Wi-Fi rather than round-tripping through a concentrator on another continent.
 
**Infrastructure access without bastions.** Port 22 stops facing the internet at all. A jump host with an open SSH port becomes a mesh node with none, and access turns identity-based: this engineer reaches staging, that one reaches production.
 
**Multi-cloud and Kubernetes.** An AWS cluster talking to a GCP cluster with no VPC peering and no public load balancers. This also sidesteps a specific organizational headache: two teams both built their networks in `10.0.0.0/16`, and overlapping ranges cannot be routed between. A mesh assigns nodes addresses from its own space (Tailscale uses `100.64.0.0/10` precisely because nobody uses it internally), so the collision never surfaces. The caveat: announce a whole subnet through a **subnet router** and the overlap problem comes right back.
 
**CI/CD runners.** Instead of punching firewall holes for a CI provider's IP ranges, an ephemeral runner joins the mesh with a short-TTL key, deploys into the private network, and vanishes when the job ends.
 
**IoT and edge.** Devices behind CGNAT in the field — kiosks, turbines, PLCs. Inbound connections are architecturally impossible; outbound always works. Here there frequently is no alternative short of driving to the site.
 
**Home labs.** A NAS or Home Assistant reachable from anywhere with zero port forwarding, or routing your hotel Wi-Fi traffic out through your own home node. Modest, but it's the use case that converts skeptics, because they can try it in ten minutes.
 
---
 
## Takeaways
 
1. **A mesh VPN is a control plane + WireGuard + NAT traversal.** Keys and discovery are centralized; your traffic is not.
2. **Relays are a fallback, not the path.** Most pairs go direct, and the relay is blind anyway.
3. **Understand the problems and every tool explains itself.** You don't need to memorize Tailscale — you can derive it.
---
 
## Going deeper
 
- [How NAT traversal works](https://tailscale.com/blog/how-nat-traversal-works) — Tailscale's write-up, and one of the best technical articles on the internet regardless of subject.
- [WireGuard whitepaper](https://www.wireguard.com/papers/wireguard.pdf) — short enough to read on a train.
- [Headscale](https://github.com/juanfont/headscale) — the open-source control plane, if you'd rather not hand yours to a SaaS.
 

