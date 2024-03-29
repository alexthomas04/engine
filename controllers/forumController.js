/**
 * Created by alexthomas on 5/5/16.
 */
var db = require('../db');
var _ = require('lodash');
require('../models/forum_post');
var forum_post_model = db.model('forum_post');
require('../models/forum_thread');
var forum_thread_model = db.model('forum_thread');
require('../models/forum_topic');
var forum_topic_model = db.model('forum_topic');
var user = require('../models/user');
var permissionGroup = require('../models/permissionGroup');
var message = require('../models/message');

function createTopic(topic) {
    return (new forum_topic_model(topic)).save();
}
function createThread(thread) {
    if (_.isString(thread.tags))
        thread.tags = thread.tags.split(' ');
    return (new forum_thread_model(thread)).save();
}
function createPost(post, user) {
    return forum_thread_model.findById(post.thread)
        .then(function (thread) {
            if (thread.locked && !user.hasPermission('Forum Admin'))
                throw 'Thread is locked';
            else {
                var threadCreator = thread.creator;
                var postCreator = post.creator;
                if (!postCreator.id === threadCreator.id)
                    user.findById(postCreator, 'username').then(function (postCreator) {
                        (new message({
                            title: postCreator.username + ' replied to your thread: ' + thread.title,
                            body: post.body,
                            toUser: threadCreator,
                            fromDelete: true
                        })).save();
                    });

                return (new forum_post_model(post)).save();
            }
        });
}

function getRootTopics() {
    return forum_topic_model.find({parent: {$exists: false}}).sort('name');
}

function lockThread(threadID, user) {
    return forum_thread_model.findByIdAndUpdate(threadID, {
        locked: true,
        $push: {history: {action: 'lock', actor: user._id}}
    });
}

function unlockThread(threadID, user) {
    return forum_thread_model.findByIdAndUpdate(threadID, {
        locked: false,
        $push: {history: {action: 'unlock', actor: user._id}}
    });
}

function pinThread(threadID, user) {
    return forum_thread_model.findByIdAndUpdate(threadID, {
        pinned: true,
        $push: {history: {action: 'pin', actor: user._id}}
    });
}

function unpinThread(threadID, user) {
    return forum_thread_model.findByIdAndUpdate(threadID, {
        pinned: false,
        $push: {history: {action: 'unpin', actor: user._id}}
    });
}

function getTopicChildren(topicId, limit, skip) {
    var getTopicsQuery = forum_topic_model.find({parent: topicId});
    getTopicsQuery = getTopicsQuery.then(function (results) {
        var promises = _.map(results, function (topic) {
            var findThreadCountPromise = forum_thread_model.find({topic: topic._id}).count();
            var findTopicCountPromise = forum_topic_model.find({parent: topic._id}).count();
            return Promise.all([findThreadCountPromise, findTopicCountPromise])
                .then(function (results) {
                    topic = JSON.parse(JSON.stringify(topic));
                    topic.threadCount = results[0];
                    topic.topicCount = results[1];
                    return topic;
                })
        });
        return Promise.all(promises);
    });
    var getThreadsQuery = forum_thread_model.find({topic: topicId});
    getThreadsQuery.sort('-pinned -creationTime');
    if (limit)
        getThreadsQuery.limit(limit);
    if (skip)
        getThreadsQuery.skip(skip);
    getThreadsQuery.populate('creator', 'username group');
    getThreadsQuery = getThreadsQuery.then(function (results) {
        return user.populate(results, {
            path: 'creator.group',
            select: 'name',
            model: permissionGroup
        })
    }).then(function (threads) {
        var promises = _.map(threads, function (thread) {
            return forum_post_model.find({thread: thread._id}).count()
                .then(function (count) {
                    thread = JSON.parse(JSON.stringify(thread));
                    thread.postCount = count;
                    return thread;
                })
        });
        return Promise.all(promises);
    });

    return Promise.all([getTopicsQuery, getThreadsQuery]).then(function (results) {
        return {topics: results[0], threads: results[1]};
    });
}

function replyToPost(reply, user) {
    return createPost(reply, user)
        .then(function (post) {
            forum_post_model.findById(post.replyTo, 'creator')
                .then(function (result) {
                    (new message({
                        title: user.username + ' replied to your post',
                        body: '[link to thread](#/forum/thread/' + post.thread + ')\r\r' + post.body,
                        toUser: result.creator,
                        fromDelete: true
                    })).save();
                });
            return forum_post_model.findByIdAndUpdate(reply.replyTo, {$push: {replies: post._id}});
        });
}

function populatePostReplies(posts) {
    var promises = [];
    posts.forEach(function (post) {
        var promise = forum_post_model.populate(post, {path: 'replies'})
            .then(function (post) {
                return post.replies ? populatePostReplies(post.replies) : post;
            });
        promises.push(promise);
    });
    return Promise.all(promises).then(function () {
        return posts;
    });

}

function getPost(id) {
    return forum_post_model.findById(id).populate('creator', 'username group').then(function (result) {
        if (result)
            return user.populate(result, {
                path: 'creator.group',
                select: 'name',
                model: permissionGroup
            }).then(function (result) {
                return populatePostReplies([result])
                    .then(function (posts) {
                        return posts[0];
                    });
            });
        else
            return result;

    })
}

function markPost(postId, type, markingUserId) {
    //get the proper array/
    //if the marking user is in the array then unmark
    var query;
    if (type === "agree") {

        query = forum_post_model.find({_id: postId, agreedBy: markingUserId}, 'id');
    }
    else if (type === "informative") {
        query = forum_post_model.find({_id: postId, markedInformativeBy: markingUserId}, 'id');
    }
    else if (type === "funny") {
        query = forum_post_model.find({_id: postId, markedFunnyBy: markingUserId}, 'id');
    }
    else if (type === "thumbsUp") {
        query = forum_post_model.find({_id: postId, thumbedUpBy: markingUserId}, 'id');
    }
    else {
        return new Promise(function (resolve, reject) {
            reject("Invalid type");
        })
    }
    return query.then(function (documents) {
        var postUpdate = {}, incrementAmount, arrayVerb, userUpdate;
        var unmark = documents.length > 0;
        if (unmark) {
            arrayVerb = '$pull';
            incrementAmount = -1;
        } else {
            arrayVerb = '$push';
            incrementAmount = 1;
        }
        postUpdate[arrayVerb] = {};
        if (type === "agree") {
            postUpdate[arrayVerb].agreedBy = markingUserId;
            userUpdate = {$inc: {"forum.agree": incrementAmount}};
        }
        else if (type === "informative") {
            postUpdate[arrayVerb].markedInformativeBy = markingUserId;
            userUpdate = {$inc: {"forum.informative": incrementAmount}};
        }
        else if (type === "funny") {
            postUpdate[arrayVerb].markedFunnyBy = markingUserId;
            userUpdate = {$inc: {"forum.funny": incrementAmount}};
        }
        else if (type === "thumbsUp") {
            postUpdate[arrayVerb].thumbedUpBy = markingUserId;
            userUpdate = {$inc: {"forum.thumbsUp": incrementAmount}};
        }
        else {
            return new Promise(function (resolve, reject) {
                reject("Invalid type");
            })
        }

        return Promise.all([
            forum_post_model.findByIdAndUpdate(postId, postUpdate),
            forum_post_model.findById(postId, 'creator').then(function (post) {
                return user.findByIdAndUpdate(post.creator._id, userUpdate)
            })
        ])
    });

}

function getThread(id) {
//TODo:
}


function getPoststByUser(userId, limit, skip) {
    return forum_post_model.find({creator: userId}, 'body thread creator lastUpdateTime creationTime').populate('creator', 'username')
        .populate('thread', 'title')
        .sort('-creationTime')
        .skip(skip)
        .limit(limit);
}

module.exports = {
    getPost: function (req, res) {
        getPost(req.params.postId)
            .then(function (post) {
                if (!post)
                    res.status(404).send('Post not found');
                else
                    res.json(post);
            }, function (err) {
                console.error(err);
                res.status(404).send('Post not found');
            })
    },
    populatePostReplies: populatePostReplies,
    createTopic: function (req, res) {
        req.body.creator = req.user._id;
        createTopic(req.body).then(function (topic) {
            res.status(201).send(topic);
        }, function (err) {
            res.status(400).send();//assumes that the information that was submitted violates the schema and caused an error when submitting
        })
    },
    createThread: function (req, res) {
        req.body.creator = req.user._id;
        createThread(req.body).then(function (thread) {
            res.status(201).send(thread);
        }, function (err) {
            res.status(400).send();//assumes that the information that was submitted violates the schema and caused an error when submitting
        })
    },
    createPost: function (req, res) {
        req.body.creator = req.user._id;
        createPost(req.body, req.user).then(function () {
            res.status(201).send();
        }, function (err) {
            res.status(400).send(err);//assumes that the information that was submitted violates the schema and caused an error when submitting
        })
    },
    lockThread: function (req, res) {
        lockThread(req.params.threadId, req.user).then(function (result) {
            if (!result)
                res.status(404).send();
            else
                res.status(201).send();
        }, function (err) {
            console.error(err);
            res.status(500).send('Server encountered an error while processing your request.');
        })
    },
    unlockThread: function (req, res) {
        unlockThread(req.params.threadId, req.user).then(function (result) {
            if (!result)
                res.status(404).send();
            else
                res.status(201).send();
        }, function (err) {
            console.error(err);
            res.status(500).send('Server encountered an error while processing your request.');
        })
    },
    unpinThread: function (req, res) {
        unpinThread(req.params.threadId, req.user).then(function (result) {
            if (!result)
                res.status(404).send();
            else
                res.status(201).send();
        }, function (err) {
            console.error(err);
            res.status(500).send('Server encountered an error while processing your request.');
        })
    },
    pinThread: function (req, res) {
        pinThread(req.params.threadId, req.user).then(function (result) {
            if (!result)
                res.status(404).send();
            else
                res.status(201).send();
        }, function (err) {
            console.error(err);
            res.status(500).send('Server encountered an error while processing your request.');
        })
    },
    getRootTopics: function (req, res) {
        getRootTopics().then(function (results) {
            res.json(results);
        }, function (err) {
            console.error(err);
            res.status(500).send('Server encountered an error while processing your request.');
        })
    },
    getTopicChildren: function (req, res) {
        var limit = Number(req.query.limit) || 15;
        if (limit > 100)
            limit = 15;
        getTopicChildren(req.params.topicId, limit, Number(req.query.skip))
            .then(function (results) {
                res.json(results);
            }, function (err) {
                console.error(err);
                res.status(500).send('Server encountered an error while processing your request.');
            })
    },
    getByTag: function (req, res) {
        var tags = [];
        if (req.params.tag) {
            tags.push(req.params.tag)
        } else if (req.body.tags) {
            tags = req.body.tags;
        }
        else {
            throw 'No Tags';
        }
        var limit = Number(req.query.limit) || 15;
        if (limit > 100)
            limit = 15;
        var skip = Number(req.query.skip) || 0;
        forum_thread_model.find({tags: {$in: tags}})
            .sort('-creationTime')
            .limit(limit)
            .skip(skip)
            .populate('creator', 'username group')
            .then(function (threads) {
                var promises = _.map(threads, function (thread) {
                    return forum_post_model.find({thread: thread._id}).count()
                        .then(function (count) {
                            thread = JSON.parse(JSON.stringify(thread));
                            thread.postCount = count;
                            return thread;
                        })
                });
                return Promise.all(promises);
            })
            .then(function (results) {
                res.json(results);
            });

    },
    search: function (req, es) {
        //TODO:
    },
    replyToPost: function (req, res) {
        var reply = req.body;
        reply.replyTo = req.params.postId;
        reply.creator = req.user._id;
        replyToPost(reply, req.user)
            .then(function () {
                res.status(201).send();
            }, function (err) {
                console.error(err);
                res.status(400).send(err);//assumes that the information that was submitted violates the schema and caused an error when submitting
            });
    },
    markPost: function (req, res) {
        var postId = req.params.postId;
        var type = req.params.type;
        var markingUserId = req.user._id;
        markPost(postId, type, markingUserId)
            .then(function () {
                    getPost(postId).then(function (postDocument) {
                        res.json(postDocument);
                    })
                },
                function (err) {
                    console.error(err);
                    res.status(500).send("Error marking the post");
                });
    },
    getPostByUser: function (req, res) {
        var limit = Number(req.query.limit) || 15;
        if (limit > 100)
            limit = 100;
        getPoststByUser(req.params.userId, limit, Number(req.query.skip) || 0)
            .then(function (results) {
                res.json(results);
            });
    }

};
