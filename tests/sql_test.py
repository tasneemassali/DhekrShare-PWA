"""Exercise the actual SQLite predicates used for pairing and cooldowns."""
import sqlite3
from pathlib import Path
c=sqlite3.connect(':memory:')
c.executescript(Path('drizzle/0000_tense_wallflower.sql').read_text())
c.execute('INSERT INTO pair(id,owner,code_hash,expires) VALUES(1,?,?,?)',('a','code',600000))
join='UPDATE pair SET guest=?,code_hash=NULL,expires=0 WHERE id=1 AND guest IS NULL AND code_hash=? AND expires>?'
assert c.execute(join,('b','bad',1000)).rowcount==0
assert c.execute(join,('b','code',600001)).rowcount==0
assert c.execute(join,('b','code',1000)).rowcount==1
assert c.execute(join,('c','code',1000)).rowcount==0
send='UPDATE pair SET owner_sent=? WHERE id=1 AND owner=? AND owner_sent<=?'
assert c.execute(send,(10000,'a',8000)).rowcount==1
assert c.execute(send,(10001,'a',8001)).rowcount==0
assert c.execute(send,(12000,'stranger',10000)).rowcount==0
assert c.execute(send,(12000,'a',10000)).rowcount==1
rate='INSERT INTO limits(id,at) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET at=excluded.at WHERE limits.at <= ?'
assert c.execute(rate,('join',10000,7000)).rowcount==1
assert c.execute(rate,('join',10001,7001)).rowcount==0
assert c.execute(rate,('join',13000,10000)).rowcount==1
print('SQLite checks passed: code expiry, single-use pairing, third device rejection, membership, cooldown, global throttle')
