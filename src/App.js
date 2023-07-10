import './App.css';
import axios from "axios";
import CryptoJS from 'crypto-js';
import React, {useEffect, useState} from "react";
import {
    BarChart,
    Bar,
    Brush,
    ReferenceLine,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer, Cell,
} from 'recharts';
import Dropdown from 'react-dropdown';
import 'react-dropdown/style.css';
// import WebSocket from 'ws';

function App() {
    const [gameID, setGameID] = useState(0);
    const [lastHash, setLastHash] = useState("");
    const [gameLogs, setGameLogs] = useState([]);
    const [count, setCount] = useState(100);
    const [start, setStart] = useState(0);
    const [patterns, setPatterns] = useState([]);
    const [graphVisible, setGraphVisible] = useState(true);
    const [stats, setStats] = useState({
        "1x": 0,
        "2x": 0,
        "10x": 0,
        "100x": 0,
    })
    const salt = "0000000000000000000e3a66df611d6935b30632f352e4934c21059696117f28";
    let timerId = -1;
    //
    // const ws = new WebSocket('ws://192.168.108.44:8000');
    //
    // ws.on('open', function open() {
    //     ws.send('something');
    // })
    // ws.on('message', function message(data) {
    //     console.log('received: %s', data);
    // })

    const gameResult = (seed, salt) => {
        const nBits = 52; // number of most significant bits to use

        // 1. HMAC_SHA256(message=seed, key=salt)
        if (salt) {
            const hmac = CryptoJS.HmacSHA256(CryptoJS.enc.Hex.parse(seed), salt);
            seed = hmac.toString(CryptoJS.enc.Hex);
        }

        // 2. r = 52 most significant bits
        seed = seed.slice(0, nBits / 4);
        const r = parseInt(seed, 16);

        // 3. X = r / 2^52
        let X = r / Math.pow(2, nBits); // uniformly distributed in [0; 1)
        X = parseFloat(X.toPrecision(9));

        // 4. X = 99 / (1-X)
        X = 99 / (1 - X);

        // 5. return max(trunc(X), 100)
        const result = Math.floor(X);
        return Math.max(1, result / 100);
    };

    const getLastGameID = async () => {
        // const res = await axios.get("http://13.208.93.236:443/api/crash", {
        const res = await axios.get("https://knklvl.xyz/api/crash", {
            headers: {
                "Access-Control-Allow-Origin": "*"
            }
        })
        if (res.data && res.data.game_id > 0) {
            setGameID(res.data.game_id)
            setLastHash(res.data.hash)
        }
        // while (true) {
        //     try {
        //         let res = await axios.post("https://bc.game/api/crash/result/recent/")
        //         const game_id = res.data.data[0].gameId;
        //         setGameID(game_id)
        //         res = await axios.get("https://bc.game/api/game/support/bet-log/all-bet/crash/" + game_id + "/")
        //         const response = JSON.parse(JSON.stringify(res.data));
        //         const game_hash = response['data']['gb']['extend']['hash'];
        //         setLastHash(game_hash);
        //         break
        //     } catch (e) {
        //         continue;
        //     }
        // }
    }
    const getGameLogs = (gameID, count, start) => {
        if (gameID > 0) {
            let prevHash = null;
            let logs = [];
            let newStats = {
                "1x": 0,
                "2x": 0,
                "10x": 0,
                "100x": 0
            }
            let currentGameID = gameID;
            for (let i = 0; i < start + count; i++) {
                const hash = String(prevHash ? CryptoJS.SHA256(String(prevHash)) : lastHash)
                const bust = gameResult(hash, salt);
                const bust_1 = bust >= 100 ? 100 : bust //20 : bust >= 10 ? 10 : bust

                prevHash = hash;
                let newLog = {gameID: currentGameID, gameID_1: currentGameID % 100000, bust, bust_1}
                if (i >= start) {
                    logs.splice(0, 0, newLog)
                    if (bust < 2) {
                        newStats["1x"] += 1
                    } else {
                        newStats["2x"] += 1
                        if (bust >= 10) {
                            newStats["10x"] += 1
                        }
                        if (bust >= 100) {
                            newStats["100x"] += 1
                        }
                    }
                }
                currentGameID -= 1;

            }
            setGameLogs(logs);
            setStats(newStats);
        }
    }

    useEffect(() => {
        let new_patterns = []
        let pattern = [];
        for (let i = 0; i < gameLogs.length; i++) {
            if (i === 0)
                pattern.push(gameLogs[i].bust >= 10 ? 2 : gameLogs[i].bust >= 2 ? 1 : 0);
            else {
                if ((gameLogs[i].bust < 2 && gameLogs[i - 1].bust >= 2) || (gameLogs[i].bust >= 2 && gameLogs[i - 1].bust < 2)) {
                    new_patterns.push(pattern)
                    pattern = [];
                }
                pattern.push(gameLogs[i].bust >= 10 ? 2 : gameLogs[i].bust >= 2 ? 1 : 0);
            }
        }
        if (pattern !== [])
            new_patterns.push(pattern)
        setPatterns(new_patterns)

    }, [gameLogs])

    useEffect(() => {
        getGameLogs(gameID, count, start);
    }, [gameID, count, start])

    useEffect(() => {
        timerId = setInterval(() => getLastGameID(), 1000)

        return () => {
            if (timerId != -1)
                clearInterval(timerId)
        }
    }, [])

    const CustomTooltip = ({active, payload, label}) => {
        if (active && payload && payload.length) {
            return (
                <div className="custom-tooltip">
                    <p className="label">{`${payload[0].payload.gameID}(${gameID - payload[0].payload.gameID}) : ${payload[0].payload.bust}`}</p>
                </div>
            );
        }

        return null;
    };

    const countOptions = [
        "100", "200", "500", "1000", "2000", "5000", "10000"
    ];

    const defaultCountOption = countOptions[0]
    const countChange = (e) => {
        setCount(parseInt(e.value))
    }

    const prevStats = () => {
        setStart(start => start + count)
    }

    const nextStats = () => {
        setStart(start => Math.max(0, start - count))
    }

    const lastStats = () => {
        setStart(0)
    }

    const showGraph = () => {
        setGraphVisible(!graphVisible)
    }

    return (
        <div className="App">
            {/*<div className="quit">I QUIT</div>*/}
            {/*<div>*/}
            {/*    {gameLogs.map(log => <p>{log.bust}</p>)}*/}
            {/*</div>*/}
            <div className="count-select">
                <label style={{padding: "10px"}}>Select data size</label>
                <Dropdown options={countOptions} onChange={countChange} value={defaultCountOption}
                          placeholder="Select count"/>
                <div className="control">
                    <button onClick={prevStats}>Prev({gameID % 100000 - start - count})</button>
                    <button onClick={nextStats}>Next({gameID % 100000 - start + count})</button>
                    <button onClick={lastStats}>Last({gameID % 100000})</button>
                    <button onClick={showGraph}>Show/Hide Graph</button>
                </div>
                <div className="stats">
                    <h3 style={{color: "#ed6300"}}>x &#x3c; 2: {stats["1x"]}</h3>
                    <h3 style={{color: "#5ddb1c"}}>x &#8805; 2: {stats["2x"]}</h3>
                    <h3 style={{color: "#f6c722"}}>x &#8805; 10: {stats["10x"]}</h3>
                    <h3 style={{color: "#f6c722"}}>x &#8805; 100: {stats["100x"]}</h3>
                </div>
            </div>
            {graphVisible ?
                <div style={{height: "600px"}}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            width={500}
                            height={300}
                            data={gameLogs}
                            barSize={10}
                        >
                            <CartesianGrid strokeDasharray="6 1"/>
                            <XAxis dataKey="gameID_1"/>
                            <YAxis tickCount={51} tickSize={2} type={"number"}/>
                            <Tooltip content={<CustomTooltip/>}/>
                            {/*<Legend verticalAlign="top" wrapperStyle={{lineHeight: '40px'}}/>*/}
                            <ReferenceLine y={0} stroke="#000"/>
                            <Brush dataKey="gameID_1" height={30} stroke="#8884d8"/>
                            <Bar dataKey="bust_1">
                                {
                                    gameLogs.map((entry, index) => {
                                        if (entry.bust < 2)
                                            return <Cell key={`cell-${index}`} fill={"#ed6300"}/>
                                        else if (entry.bust < 10)
                                            return <Cell key={`cell-${index}`} fill={"#5ddb1c"}/>
                                        else if (entry.bust < 100)
                                            return <Cell key={`cell-${index}`} fill={"#f6c722"}/>
                                        else
                                            return <Cell key={`cell-${index}`} fill={"cyan"}/>

                                    })
                                }
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div> :
                <div className="bust-wrapper">
                    {gameLogs.map((log, idx) => {
                        if (log.bust < 2) {
                            return <div className="bust bust-red">{log.bust}</div>
                        }
                        else if(log.bust < 10) {
                            return <div className="bust bust-green">{log.bust}</div>
                        }
                        else if(log.bust < 100) {
                            return <div className="bust bust-moon">{log.bust}</div>
                        }
                        else {
                            return <div className="bust bust-sky">{log.bust}</div>
                        }
                    })}
                </div>
            }
            <div className="dots-wrap">
                {patterns.map(p => {
                    return <div className="dots">
                        {p.map(c => {
                            return c === 0 ? <div className="dot dot-red"/> : c === 1 ?
                                <div className="dot dot-green"/> : <div className="dot dot-moon"/>
                        })}
                    </div>
                })}
            </div>
        </div>
    );
}

export default App;
